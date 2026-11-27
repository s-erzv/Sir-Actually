/**
 * POST /api/encounter/answer
 *
 * Server-authoritative encounter turn:
 *   1. load run + encounter (create on first answer)
 *   2. retrieve manuscript context around the challenged finding
 *   3. LLMProvider.judgeAnswer (OpenRouter; no dummy fallback)
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
import { evaluateAnswer, type EvaluateResult } from "@/lib/judge/evaluate";
import { COMPREHENSION_RUBRIC, RUBRICS, getScoreMax } from "@/lib/rubrics";
import { AnswerRequestSchema, AttackTypeSchema, pickTargetCriteria } from "@/lib/encounter/schema";
import { checkQuestionQuality } from "@/lib/encounter/questionQuality";
import { findBankQuestion } from "@/lib/encounter/questionBank";
import { PROMPT_VERSION as JUDGE_PROMPT_VERSION } from "@/lib/prompts/judge_v1";
import { retrieveChunks } from "@/lib/rag/retrieve";
import { heartsForLoadout } from "@/lib/loadout";
import { answerQuality, usesManuscriptEvidence } from "@/lib/combat/quality";
import { monsterLevel, monsterStats } from "@/lib/combat/monsterStats";
import { resolveCombat } from "@/lib/combat/resolve";
import { ABSORB } from "@/lib/combat/shop";
import { loadWallet } from "@/lib/api/run";
import { HEART_HP, MIN_ANSWER_LENGTH, POINTS_DWELLER_WON } from "@/lib/balance";
import { isDwellerRoom } from "@/lib/dungeon/dwellers";
import { resolveDwellerClaim } from "@/lib/dungeon/dwellerClaim";
import { pointsForMonster } from "@/lib/score";
import { WEAKNESS_DIMENSION, BOSS_BY_DIMENSION } from "@/game/map/buildFloorPlan";
import { BOSS_ROSTER } from "@/lib/monsters";
import type { RagRpcClient } from "@/lib/rag/types";
import type {
  CombatOutcome,
  EncounterStatus,
  EvaluationResult,
  MonsterKind,
  WeaknessType,
} from "@/lib/domain/types";
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
  /** The whole exchange, for the screen to play back. */
  combat: CombatOutcome;
  /** Player HP after the exchange; one Heart holds HEART_HP. */
  hp: number;
  hpMax: number;
  /** Equipped armor after the exchange; null when none or broken. */
  armor: { slug: string; name: string; shield: number; shieldMax: number } | null;
  monsterLevel: number;
  monsterHpMax: number;
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
      .select("id, research_map_id, status, hearts_left, points_total, character_slug, weapon_slug")
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
    let finding: { weakness_type: string; evidence_quote: string; severity: number } | null = null;
    if (findingId) {
      const { data, error } = await admin
        .from("findings")
        .select("research_map_id, weakness_type, evidence_quote, severity")
        .eq("id", findingId)
        .maybeSingle();
      if (error) throw new ApiError(error.message, 500);
      if (!data || data.research_map_id !== map.id) {
        throw new ApiError("Temuan tidak ditemukan.", 404);
      }
      finding = data;
    }

    // A dweller is identified by its room number, never by what the client
    // claims: its topic, claim and rubric all come from the server.
    const dweller = isDwellerRoom(body.roomOrder)
      ? await resolveDwellerClaim(admin, map.id, body.floorOrder, body.roomOrder)
      : null;
    if (dweller && findingId) throw new ApiError("Penghuni tidak terkait temuan.", 400);

    const weaknessType = (finding?.weakness_type ?? body.weaknessType) as WeaknessType;
    const rubricCriteria = dweller ? COMPREHENSION_RUBRIC : RUBRICS[weaknessType];
    if (!rubricCriteria) throw new ApiError(`Unknown weaknessType: ${weaknessType}`, 400);

    const isBoss =
      encounter?.is_boss ??
      (BOSS_ROSTER[body.bossSlug]
        ? true
        : body.bossSlug.startsWith("minion-")
          ? false
          : body.isBoss);
    if (dweller && isBoss) throw new ApiError("Penghuni bukan boss.", 400);
    const kind: MonsterKind = dweller ? "dweller" : isBoss ? "boss" : "minion";
    const level = monsterLevel({ kind, floorOrder: body.floorOrder, severity: finding?.severity });
    const stats = monsterStats(kind, level);
    const hpMax = stats.hp;
    // encounters.boss_slug references bosses(slug); `minion-*` is not in that
    // catalogue, so store the floor boss slug while question persona stays
    // the minion's.
    const dimension = dweller?.dimension ?? WEAKNESS_DIMENSION[weaknessType] ?? "audit";
    const encounterBossSlug = dweller
      ? dweller.floorBossSlug
      : BOSS_ROSTER[body.bossSlug]
        ? body.bossSlug
        : (BOSS_BY_DIMENSION[dimension as keyof typeof BOSS_BY_DIMENSION] ?? "veylith");

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

    let evidenceQuote = dweller
      ? dweller.sourceQuote
      : finding?.evidence_quote || body.evidenceQuote || "";
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
    const expectedTargets = dweller
      ? rubricCriteria.map((criterion) => criterion.id)
      : parsedAttack?.success
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

    // A too-short answer deals no damage and draws no counter (BRIEF §13.4).
    // Skip the Judge entirely: no model call, no score, no Heart loss.
    const tooShort = body.answer.trim().length < MIN_ANSWER_LENGTH;
    const provider = tooShort ? null : getLLMProviderForJudge(body.bossSlug);
    if (provider?.providerName === "dummy") {
      throw new ApiError("LLM belum dikonfigurasi untuk menilai jawaban.", 503);
    }

    const judged: EvaluateResult = tooShort
      ? {
          scores: rubricIds.map((id) => ({ criterionId: id, level: 0, quote: "", capApplied: false })),
          caps: [],
          scoreTotal: 0,
          missing: "Jawaban terlalu pendek. Tulis dulu minimal 12 karakter.",
          addressed: false,
          heartLost: false,
          rawOutput: {
            criteria: rubricIds.map((id) => ({ id, level: 0, quote: "" })),
            missing: "Jawaban terlalu pendek.",
            addressed: false,
            verdict: "nonsense",
          },
          judgedBy: "code",
        }
      : await evaluateAnswer(provider!, {
          playerAnswer: body.answer,
          question: questionText,
          evidenceQuote,
          weaknessType,
          targetCriteria,
          sourceText: map.source_text,
          knownCitations: (citations ?? []).map((citation) => citation.raw_text),
          contextChunks: retrieval.chunks.map((chunk) => ({
            section: chunk.sectionLabel,
            text: chunk.text,
          })),
        });
    const { rawOutput, scores, caps, scoreTotal, addressed } = judged;

    // The run's own character decides the arsenal; the client cannot pick one.
    const characterSlug = run.character_slug ?? body.characterSlug ?? "arka";
    const citationTexts = (citations ?? []).map((citation) => citation.raw_text);
    const hpBefore = encounter.hp_end ?? encounter.hp_start ?? hpMax;
    const previousQuestionsAsked = encounter.questions_asked;
    const playerHpMax = heartsForLoadout(characterSlug) * HEART_HP;
    const playerHpBefore = Math.min(playerHpMax, run.hearts_left);

    const usedEvidence = usesManuscriptEvidence(body.answer, map.source_text, citationTexts);
    const quality = tooShort
      ? 0
      : answerQuality({ scoreTotal, scoreMax, addressed, usedEvidence });
    // Bought weapon and armor shield come from the run's own events.
    const wallet = await loadWallet(admin, run.id);
    const strike = {
      characterSlug,
      weapon: wallet.weapon,
      shield: wallet.armor?.shield ?? 0,
      quality,
      usedEvidence,
      answer: body.answer,
      sourceText: map.source_text,
      citations: citationTexts,
      enemyHpRatio: hpMax > 0 ? hpBefore / hpMax : 1,
      firstAnswer: previousQuestionsAsked === 0,
      monsterAttack: stats.attack,
    };
    const combat = resolveCombat({ ...strike, tooShort });

    const damage = combat.damage;
    const newHp = Math.max(0, hpBefore - damage);
    const playerHp = Math.max(0, playerHpBefore - combat.counterDamage);
    const heartsBefore = Math.ceil(playerHpBefore / HEART_HP);
    const newHearts = Math.ceil(playerHp / HEART_HP);
    const heartLost = newHearts < heartsBefore;
    const newQuestionsAsked = previousQuestionsAsked + 1;
    const maxQuestions = stats.maxQuestions;

    let encounterStatus: EncounterStatus;
    if (newHp <= 0 && damage > 0) {
      encounterStatus = "won";
    } else if (playerHp <= 0) {
      encounterStatus = "lost";
    } else if (newHp <= 0 || newQuestionsAsked >= maxQuestions) {
      // A zero-damage answer must never kill a monster; if HP was already
      // exhausted by an earlier hit, the room closes as conceded instead.
      encounterStatus = "conceded";
    } else {
      encounterStatus = "active";
    }

    // Claim this turn before writing anything else: a double submit of the
    // same answer finds questions_asked already advanced and stops here.
    const { data: claimed, error: claimError } = await admin
      .from("encounters")
      .update({
        status: encounterStatus,
        hp_end: newHp,
        questions_asked: newQuestionsAsked,
        resolved_at: encounterStatus === "active" ? null : new Date().toISOString(),
      })
      .eq("id", encounter.id)
      .eq("questions_asked", previousQuestionsAsked)
      .select("id");
    if (claimError) throw new ApiError(claimError.message, 500);
    if (!claimed || claimed.length === 0) {
      throw new ApiError("Jawaban ini sudah diproses.", 409);
    }

    // The armor's shield takes its share only once this turn is ours.
    if (combat.absorbed > 0) {
      const { error: absorbError } = await admin.from("run_points_events").insert({
        run_id: run.id,
        kind: ABSORB,
        encounter_key: `absorb:${encounter.id}:${newQuestionsAsked}:abs${combat.absorbed}`,
        seq: 0,
        amount: 0,
      });
      if (absorbError && absorbError.code !== "23505") throw new ApiError(absorbError.message, 500);
    }
    const armorAfter =
      wallet.armor && !combat.armorBroken
        ? {
            slug: wallet.armor.slug,
            name: wallet.armor.name,
            shield: wallet.armor.shield - combat.absorbed,
            shieldMax: wallet.armor.shieldMax,
          }
        : null;

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
    const rubricId = dimension;
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
      judge_model: provider?.modelName ?? "short_answer",
      prompt_version: JUDGE_PROMPT_VERSION,
    });
    if (evaluationError) throw new ApiError(evaluationError.message, 500);

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
      .update({ hearts_left: playerHp })
      .eq("id", run.id);
    if (heartError) throw new ApiError(heartError.message, 500);

    let pointsAwarded = 0;
    let lootAwarded = 0;
    let lootKind: "zonk" | "coins" | "gem" = "zonk";
    if (encounterStatus === "won") {
      const amount = kind === "dweller" ? POINTS_DWELLER_WON : pointsForMonster(isBoss);
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
      weaponUsed: combat.weaponSlug,
      combat,
      hp: playerHp,
      hpMax: playerHpMax,
      armor: armorAfter,
      monsterLevel: level,
      monsterHpMax: hpMax,
    };

    return NextResponse.json(response);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
