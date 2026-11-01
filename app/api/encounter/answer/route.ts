/**
 * POST /api/encounter/answer
 *
 * Runs the Judge pipeline for one player answer:
 *   1. retrieve manuscript context around the challenged finding
 *   2. LLMProvider.judgeAnswer (Kagiro; no dummy fallback)
 *   3. validateQuotes
 *   4. applyRules
 *   5. computeDamage + computeHeartLoss
 */

import { NextRequest, NextResponse } from "next/server";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getLLMProviderForBoss } from "@/lib/llm";
import { validateQuotes } from "@/lib/judge/validateQuotes";
import { applyRules } from "@/lib/judge/rules";
import { computeDamage, computeHeartLoss } from "@/lib/judge/damage";
import { RUBRICS, getScoreMax } from "@/lib/rubrics";
import { BOSS_HP, MINION_HP, MAX_QUESTIONS_BOSS, MAX_QUESTIONS_MINION } from "@/lib/balance";
import { retrieveChunks } from "@/lib/rag/retrieve";
import { autoWeaponBonus, getCharacter } from "@/lib/loadout";
import { pointsForMonster } from "@/lib/score";
import type { RagRpcClient } from "@/lib/rag/types";
import type { WeaknessType, EvaluationResult, EncounterStatus } from "@/lib/domain/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface AnswerRequest {
  encounterId: string;
  researchMapId: string;
  findingId?: string;
  weaknessType: WeaknessType;
  bossSlug?: string;
  answer: string;
  evidenceQuote?: string;
  isBoss: boolean;
  hp: number;
  hearts: number;
  questionsAsked: number;
  characterSlug?: string;
  weaponSlug?: string;
  runId?: string;
}

interface AnswerResponse {
  evaluation: EvaluationResult;
  newHp: number;
  newHearts: number;
  encounterStatus: EncounterStatus;
  pointsAwarded: number;
  pointsTotal: number;
  weaponUsed: string | null;
  weaponBonus: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(req);
    let body: AnswerRequest;
    try {
      body = (await req.json()) as AnswerRequest;
    } catch {
      throw new ApiError("Invalid JSON body", 400);
    }
    if (!body.researchMapId) throw new ApiError("researchMapId wajib diisi.", 400);

    const { map } = await loadOwnedResearchMap(body.researchMapId, user.id);
    const admin = getAdminSupabase();

    let finding: { weakness_type: string; evidence_quote: string } | null = null;
    if (body.findingId) {
      const { data, error } = await admin
        .from("findings")
        .select("research_map_id, weakness_type, evidence_quote")
        .eq("id", body.findingId)
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

    const { data: citations, error: citationsError } = await admin
      .from("citations")
      .select("raw_text")
      .eq("research_map_id", map.id)
      .eq("is_injected", false);
    if (citationsError) throw new ApiError(citationsError.message, 500);

    const evidenceQuote = finding?.evidence_quote || body.evidenceQuote || "";
    const retrieval = await retrieveChunks(admin as unknown as RagRpcClient, {
      manuscriptId: map.manuscript_id,
      version: map.version,
      query: [evidenceQuote, weaknessType].filter(Boolean).join(" "),
      limit: 3,
    });

    const rubricIds = rubricCriteria.map((criterion) => criterion.id);
    const scoreMax = getScoreMax(weaknessType);
    const hpMax = body.isBoss ? BOSS_HP : MINION_HP;

    const provider = getLLMProviderForBoss(body.bossSlug);
    if (provider.providerName === "dummy") {
      throw new ApiError("LLM belum dikonfigurasi untuk menilai jawaban.", 503);
    }

    const rawOutput = await provider.judgeAnswer({
      playerAnswer: body.answer,
      evidenceQuote,
      weaknessType,
      rubricCriteria,
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
    const pickedWeapon = character
      ? autoWeaponBonus({
          characterSlug,
          answer: body.answer,
          sourceText: map.source_text,
          citations: (citations ?? []).map((citation) => citation.raw_text),
          firstAnswer: body.questionsAsked === 0,
          enemyHpRatio: hpMax > 0 ? body.hp / hpMax : 1,
        })
      : { weaponSlug: null, bonus: 1 };
    const weaponBonus = pickedWeapon.bonus;

    const scoreTotal = scores.reduce((sum, score) => sum + score.level, 0);
    const damage = computeDamage(scoreTotal, scoreMax, body.isBoss, hpMax, weaponBonus);
    const heartLost = computeHeartLoss(scoreTotal);
    const newHp = Math.max(0, body.hp - damage);
    const newHearts = heartLost ? Math.max(0, body.hearts - 1) : body.hearts;
    const newQuestionsAsked = body.questionsAsked + 1;
    const maxQuestions = body.isBoss ? MAX_QUESTIONS_BOSS : MAX_QUESTIONS_MINION;

    let encounterStatus: EncounterStatus;
    if (newHp <= 0) {
      encounterStatus = "won";
    } else if (newHearts <= 0) {
      encounterStatus = "lost";
    } else if (newQuestionsAsked >= maxQuestions) {
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
    };

    let pointsAwarded = 0;
    let pointsTotal = 0;
    if (body.runId) {
      const { data: run, error: runError } = await admin
        .from("runs")
        .select("id, research_map_id, points_total")
        .eq("id", body.runId)
        .maybeSingle();
      if (runError) throw new ApiError(runError.message, 500);
      if (!run || run.research_map_id !== map.id) {
        throw new ApiError("Run tidak ditemukan.", 404);
      }

      const { error: heartError } = await admin
        .from("runs")
        .update({ hearts_left: newHearts })
        .eq("id", run.id);
      if (heartError) throw new ApiError(heartError.message, 500);

      if (encounterStatus === "won") {
        const amount = pointsForMonster(body.isBoss);
        const { error: eventError } = await admin.from("run_points_events").insert({
          run_id: run.id,
          kind: "monster_won",
          encounter_key: body.encounterId,
          seq: 0,
          amount,
        });
        if (eventError && eventError.code !== "23505") {
          throw new ApiError(eventError.message, 500);
        }
        if (!eventError) pointsAwarded = amount;
      }

      const { data: events, error: eventsError } = await admin
        .from("run_points_events")
        .select("amount")
        .eq("run_id", run.id);
      if (eventsError) throw new ApiError(eventsError.message, 500);
      pointsTotal = (events ?? []).reduce((sum, event) => sum + event.amount, 0);
      const { error: pointError } = await admin
        .from("runs")
        .update({ points_total: pointsTotal })
        .eq("id", run.id);
      if (pointError) throw new ApiError(pointError.message, 500);
    }

    const response: AnswerResponse = {
      evaluation,
      newHp,
      newHearts,
      encounterStatus,
      pointsAwarded,
      pointsTotal,
      weaponUsed: pickedWeapon.weaponSlug,
      weaponBonus,
    };

    return NextResponse.json(response);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
