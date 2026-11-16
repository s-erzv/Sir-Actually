/**
 * POST /api/encounter/answer
 *
 * Server-authoritative encounter turn:
 *   1. load run + encounter (create on first answer)
 *   2. retrieve manuscript context around the challenged finding
 *   3. LLMProvider.judgeAnswer (Kagiro; no dummy fallback)
 *   4. validateQuotes + applyRules
 *   5. computeDamage + computeHeartLoss
 *   6. persist turns, evaluation, encounter state, run hearts/points
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getLLMProviderForJudge } from "@/lib/llm";
import { validateQuotes } from "@/lib/judge/validateQuotes";
import { applyRules } from "@/lib/judge/rules";
import { computeDamage, computeHeartLoss } from "@/lib/judge/damage";
import { RUBRICS, getScoreMax } from "@/lib/rubrics";
import { AnswerRequestSchema, AttackTypeSchema, pickTargetCriteria } from "@/lib/encounter/schema";
import { checkQuestionQuality } from "@/lib/encounter/questionQuality";
import { findBankQuestion } from "@/lib/encounter/questionBank";
import { PROMPT_VERSION as JUDGE_PROMPT_VERSION } from "@/lib/prompts/judge_v1";
import { BOSS_HP, MINION_HP, MAX_QUESTIONS_BOSS, MAX_QUESTIONS_MINION } from "@/lib/balance";
import { retrieveChunks } from "@/lib/rag/retrieve";
import { autoWeaponBonus, getCharacter } from "@/lib/loadout";
import { pointsForMonster } from "@/lib/score";
import { WEAKNESS_DIMENSION, BOSS_BY_DIMENSION } from "@/game/map/buildFloorPlan";
import { BOSS_ROSTER } from "@/lib/monsters";
import type { RagRpcClient } from "@/lib/rag/types";
import type { WeaknessType, EvaluationResult, EncounterStatus } from "@/lib/domain/types";
import type { Database, Json } from "@/lib/supabase/database";

export const runtime = "nodejs";
export const maxDuration = 120;

type EncounterRow = Database["public"]["Tables"]["encounters"]["Row"];

interface AnswerResponse {
  evaluation: EvaluationResult;
  newHp: number;
  newHearts: number;
  encounterStatus: EncounterStatus;
  pointsAwarded: number;
  lootAwarded: number;
  lootKind: "zonk" | "coins" | "gem";
  pointsTotal: number;
  weaponUsed: string | null;
  weaponBonus: number;
}

function treasureRoll(key: string): { amount: number; kind: "zonk" | "coins" | "gem" } {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  const roll = hash % 100;
  if (roll < 32) return { amount: 0, kind: "zonk" };
  if (roll < 72) return { amount: 5, kind: "coins" };
  if (roll < 94) return { amount: 10, kind: "coins" };
  return { amount: 25, kind: "gem" };
}

function questionHash(question: string): string {
  return createHash("sha256")
    .update(question.trim().replace(/\s+/g, " "))
    .digest("hex")
    .slice(0, 32);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(req);
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      throw new ApiError("Invalid JSON body", 400);
    }
    const parsed = AnswerRequestSchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Input tidak valid.", 400);
    }
    const body = parsed.data;

    const { map } = await loadOwnedResearchMap(body.researchMapId, user.id);
    const admin = getAdminSupabase();

    // Prefer the server-cached question over whatever the client sent.
    const bankQuestion = findBankQuestion(
      map.question_bank,
      body.encounterKey,
      body.question,
    );
    const questionText = bankQuestion?.question ?? body.question;
    const attackTypeText = bankQuestion?.attackType ?? body.attackType;
    const bankTargets = bankQuestion?.targetCriterionIds ?? body.targetCriterionIds;

    const { data: run, error: runError } = await admin
      .from("runs")
      .select("id, research_map_id, status, hearts_left, points_total")
      .eq("id", body.runId)
      .maybeSingle();
    if (runError) throw new ApiError(runError.message, 500);
    if (!run || run.research_map_id !== map.id || run.status !== "active") {
      throw new ApiError("Run aktif tidak ditemukan.", 404);
    }

    // Encounter is identified by its stable position, not by client HP state.
    let encounter: EncounterRow | null = null;
    {
      const { data, error } = await admin
        .from("encounters")
        .select("*")
        .eq("run_id", run.id)
        .eq("floor_order", body.floorOrder)
        .eq("room_order", body.roomOrder)
        .maybeSingle();
      if (error) throw new ApiError(error.message, 500);
      encounter = data;
    }

    const findingId = encounter?.finding_id ?? body.findingId ?? null;
    let finding: { weakness_type: string; evidence_quote: string } | null = null;
    if (findingId) {
      const { data, error } = await admin
        .from("findings")
        .select("research_map_id, weakness_type, evidence_quote")
        .eq("id", findingId)
        .maybeSingle();
      if (error) throw new ApiError(error.message, 500);
      if (!data || data.research_map_id !== map.id) {
        throw new ApiError("Temuan tidak ditemukan.", 404);
      }
      finding = data;
    }

    const weaknessType = (finding?.weakness_type ?? body.weaknessType) as WeaknessType;
    const rubricCriteria = RUBRICS[weaknessType];
    if (!rubricCriteria) throw new ApiError(`Unknown weaknessType: ${weaknessType}`, 400);

    const isBoss =
      encounter?.is_boss ??
      (BOSS_ROSTER[body.bossSlug]
        ? true
        : body.bossSlug.startsWith("minion-")
          ? false
          : body.isBoss);
    const hpMax = isBoss ? BOSS_HP : MINION_HP;
    // encounters.boss_slug references bosses(slug); `minion-*` is not in that
    // catalogue, so store the floor boss slug while question persona stays
    // the minion's.
    const dimension = WEAKNESS_DIMENSION[weaknessType] ?? "audit";
    const encounterBossSlug = BOSS_ROSTER[body.bossSlug]
      ? body.bossSlug
      : (BOSS_BY_DIMENSION[dimension] ?? "veylith");

    if (!encounter) {
      const insert = {
        run_id: run.id,
        boss_slug: encounterBossSlug,
        finding_id: findingId,
        is_boss: isBoss,
        floor_order: body.floorOrder,
        room_order: body.roomOrder,
        status: "active" as const,
        hp_start: hpMax,
        hp_end: hpMax,
        questions_asked: 0,
      };
      const { data, error } = await admin.from("encounters").insert(insert).select("*").single();
      if (error && error.code !== "23505") throw new ApiError(error.message, 500);
      if (data) {
        encounter = data;
      } else {
        const { data: raced, error: racedError } = await admin
          .from("encounters")
          .select("*")
          .eq("run_id", run.id)
          .eq("floor_order", body.floorOrder)
          .eq("room_order", body.roomOrder)
          .maybeSingle();
        if (racedError) throw new ApiError(racedError.message, 500);
        encounter = raced;
      }
    }

    if (!encounter) throw new ApiError("Encounter tidak dapat dibuat.", 500);
    if (encounter.status !== "active" && encounter.status !== "pending") {
      throw new ApiError("Encounter sudah selesai.", 409);
    }

    const { data: citations, error: citationsError } = await admin
      .from("citations")
      .select("raw_text")
      .eq("research_map_id", map.id)
      .eq("is_injected", false);
    if (citationsError) throw new ApiError(citationsError.message, 500);

    let evidenceQuote = finding?.evidence_quote || body.evidenceQuote || "";
    if (weaknessType === "citation_claim_mismatch" || weaknessType === "citation_not_found") {
      const { data: ghost } = await admin
        .from("citations")
        .select("raw_text")
        .eq("research_map_id", map.id)
        .eq("is_injected", true)
        .maybeSingle();
      if (ghost?.raw_text) evidenceQuote = ghost.raw_text;
    }
    const retrieval = await retrieveChunks(admin as unknown as RagRpcClient, {
      manuscriptId: map.manuscript_id,
      version: map.version,
      query: [evidenceQuote, weaknessType].filter(Boolean).join(" "),
      limit: 3,
    });

    // Questions are generated from weakness + attack type + monster kind.
    // Recompute the target criteria so the client cannot hand-pick easy ones.
    const parsedAttack = attackTypeText ? AttackTypeSchema.safeParse(attackTypeText) : null;
    const expectedTargets = parsedAttack?.success
      ? pickTargetCriteria(rubricCriteria, parsedAttack.data, isBoss).map(
          (criterion) => criterion.id,
        )
      : [];
    const requestedTargets = Array.from(
      new Set(expectedTargets.length > 0 ? expectedTargets : (bankTargets ?? [])),
    );
    const targetCriteria = requestedTargets.length
      ? rubricCriteria.filter((criterion) => requestedTargets.includes(criterion.id))
      : rubricCriteria;
    if (targetCriteria.length === 0) {
      throw new ApiError("targetCriterionIds tidak cocok dengan rubrik.", 400);
    }
    const rubricIds = targetCriteria.map((criterion) => criterion.id);
    const scoreMax = requestedTargets.length
      ? rubricIds.length * 2
      : getScoreMax(weaknessType);

    if (questionText) {
      const quality = checkQuestionQuality({
        question: questionText,
        targetCriteria,
        evidenceQuote,
        sourceText: map.source_text,
        maxWords: 28,
      });
      if (!quality.ok) {
        throw new ApiError(`Pertanyaan tidak valid: ${quality.repair}`, 400);
      }
    }

    const provider = getLLMProviderForJudge(body.bossSlug);
    if (provider.providerName === "dummy") {
      throw new ApiError("LLM belum dikonfigurasi untuk menilai jawaban.", 503);
    }

    const rawOutput = await provider.judgeAnswer({
      playerAnswer: body.answer,
      question: questionText,
      evidenceQuote,
      weaknessType,
      rubricCriteria: targetCriteria,
      previousQuestions: [],
      contextChunks: retrieval.chunks.map((chunk) => ({
        section: chunk.sectionLabel,
        text: chunk.text,
      })),
    });

    const validated = validateQuotes(rawOutput, body.answer, rubricIds);
    const { scores, caps } = applyRules(validated, {
      playerAnswer: body.answer,
      sourceText: map.source_text,
      weaknessType,
      knownCitations: (citations ?? []).map((citation) => citation.raw_text),
    });

    const characterSlug = body.characterSlug ?? "";
    const character = getCharacter(characterSlug);
    const hpBefore = encounter.hp_end ?? encounter.hp_start ?? hpMax;
    const previousQuestionsAsked = encounter.questions_asked;
    const pickedWeapon = character
      ? autoWeaponBonus({
          characterSlug,
          answer: body.answer,
          sourceText: map.source_text,
          citations: (citations ?? []).map((citation) => citation.raw_text),
          firstAnswer: previousQuestionsAsked === 0,
          enemyHpRatio: hpMax > 0 ? hpBefore / hpMax : 1,
        })
      : { weaponSlug: null, bonus: 1 };
    const weaponBonus = pickedWeapon.bonus;

    const scoreTotal = scores.reduce((sum, score) => sum + score.level, 0);
    const damage = computeDamage(scoreTotal, scoreMax, isBoss, hpMax, weaponBonus);
    // Benefit of the doubt: if the Judge omitted `addressed` on a question-bound
    // answer, do not punish the player with a Heart.
    const addressed = rawOutput.addressed ?? (questionText ? true : undefined);
    let heartLost = computeHeartLoss(scoreTotal, addressed);

    // Sena's Perisai Batas: once per floor, cancel one Heart loss.
    if (heartLost && pickedWeapon.weaponSlug === "perisai_batas") {
      const { error: shieldError } = await admin.from("run_points_events").insert({
        run_id: run.id,
        kind: "shield_used",
        encounter_key: `shield:${body.floorOrder}`,
        seq: 0,
        amount: 0,
      });
      if (!shieldError) heartLost = false;
      else if (shieldError.code !== "23505") {
        throw new ApiError(shieldError.message, 500);
      }
    }
    const newHp = Math.max(0, hpBefore - damage);
    const newHearts = heartLost ? Math.max(0, run.hearts_left - 1) : run.hearts_left;
    const newQuestionsAsked = previousQuestionsAsked + 1;
    const maxQuestions = isBoss ? MAX_QUESTIONS_BOSS : MAX_QUESTIONS_MINION;

    let encounterStatus: EncounterStatus;
    if (newHp <= 0 && damage > 0) {
      encounterStatus = "won";
    } else if (newHearts <= 0) {
      encounterStatus = "lost";
    } else if (newHp <= 0 || newQuestionsAsked >= maxQuestions) {
      // A zero-damage answer must never kill a monster; if HP was already
      // exhausted by an earlier hit, the room closes as conceded instead.
      encounterStatus = "conceded";
    } else {
      encounterStatus = "active";
    }

    const evaluation: EvaluationResult = {
      scores,
      scoreTotal,
      scoreMax,
      damage,
      heartLost,
      missing: rawOutput.missing,
      ruleCaps: caps,
      addressed,
      targetCriterionIds: rubricIds,
    };

    // ── Persist turns + evaluation ─────────────────────────────────────────
    const { data: lastTurn, error: lastTurnError } = await admin
      .from("turns")
      .select("seq")
      .eq("encounter_id", encounter.id)
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastTurnError) throw new ApiError(lastTurnError.message, 500);
    let seq = (lastTurn?.seq ?? 0) + 1;

    const question = questionText?.trim();
    if (question) {
      const { error: bossTurnError } = await admin.from("turns").insert({
        encounter_id: encounter.id,
        seq,
        role: "boss",
        text: question,
        attack_type: attackTypeText ?? null,
        question_hash: questionHash(question),
      });
      if (bossTurnError) throw new ApiError(bossTurnError.message, 500);
      seq += 1;
    }

    const { data: playerTurn, error: playerTurnError } = await admin
      .from("turns")
      .insert({
        encounter_id: encounter.id,
        seq,
        role: "player",
        text: body.answer,
        attack_type: attackTypeText ?? null,
      })
      .select("id")
      .single();
    if (playerTurnError) throw new ApiError(playerTurnError.message, 500);

    const evidenceQuotes = Object.fromEntries(
      scores.map((score) => [score.criterionId, score.quote]),
    );
    const rubricId = WEAKNESS_DIMENSION[weaknessType] ?? "audit";
    const { error: evaluationError } = await admin.from("evaluations").insert({
      turn_id: playerTurn.id,
      rubric_id: rubricId,
      scores: scores as unknown as Json,
      evidence_quotes: evidenceQuotes as unknown as Json,
      score_total: scoreTotal,
      score_max: scoreMax,
      damage,
      heart_lost: heartLost,
      missing: rawOutput.missing,
      rule_caps: caps as unknown as Json,
      raw_judge_output: rawOutput as unknown as Json,
      judge_model: provider.modelName,
      prompt_version: JUDGE_PROMPT_VERSION,
    });
    if (evaluationError) throw new ApiError(evaluationError.message, 500);

    const resolvedAt =
      encounterStatus === "active" ? null : new Date().toISOString();
    const { error: encounterError } = await admin
      .from("encounters")
      .update({
        status: encounterStatus,
        hp_end: newHp,
        questions_asked: newQuestionsAsked,
        resolved_at: resolvedAt,
      })
      .eq("id", encounter.id);
    if (encounterError) throw new ApiError(encounterError.message, 500);

    if (findingId && (encounterStatus === "won" || encounterStatus === "conceded")) {
      const { error: findingError } = await admin
        .from("findings")
        .update({ status: encounterStatus === "won" ? "defended" : "conceded" })
        .eq("id", findingId)
        .eq("research_map_id", map.id);
      if (findingError) throw new ApiError(findingError.message, 500);
    }

    const { error: heartError } = await admin
      .from("runs")
      .update({ hearts_left: newHearts })
      .eq("id", run.id);
    if (heartError) throw new ApiError(heartError.message, 500);

    let pointsAwarded = 0;
    let lootAwarded = 0;
    let lootKind: "zonk" | "coins" | "gem" = "zonk";
    if (encounterStatus === "won") {
      const amount = pointsForMonster(isBoss);
      const pointsKey = body.encounterKey ?? body.encounterId;
      const { error: eventError } = await admin.from("run_points_events").insert({
        run_id: run.id,
        kind: "monster_won",
        encounter_key: pointsKey,
        seq: 0,
        amount,
      });
      if (eventError && eventError.code !== "23505") {
        throw new ApiError(eventError.message, 500);
      }
      if (!eventError) pointsAwarded = amount;

      const loot = treasureRoll(`${run.id}:${pointsKey}`);
      lootKind = loot.kind;
      const { error: lootError } = await admin.from("run_points_events").insert({
        run_id: run.id,
        kind: "treasure",
        encounter_key: pointsKey,
        seq: 0,
        amount: loot.amount,
      });
      if (lootError && lootError.code !== "23505") {
        throw new ApiError(lootError.message, 500);
      }
      if (!lootError) lootAwarded = loot.amount;
    }

    const { data: events, error: eventsError } = await admin
      .from("run_points_events")
      .select("amount")
      .eq("run_id", run.id);
    if (eventsError) throw new ApiError(eventsError.message, 500);
    const pointsTotal = (events ?? []).reduce((sum, event) => sum + event.amount, 0);
    const { error: pointError } = await admin
      .from("runs")
      .update({ points_total: pointsTotal })
      .eq("id", run.id);
    if (pointError) throw new ApiError(pointError.message, 500);

    const response: AnswerResponse = {
      evaluation,
      newHp,
      newHearts,
      encounterStatus,
      pointsAwarded,
      lootAwarded,
      lootKind,
      pointsTotal,
      weaponUsed: pickedWeapon.weaponSlug,
      weaponBonus,
    };

    return NextResponse.json(response);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
