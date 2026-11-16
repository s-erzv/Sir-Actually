/**
 * lib/encounter/generate.ts — shared Questioner pipeline.
 *
 * Used by both the single-question route (fallback when a prefetched bank is
 * empty) and the batch route (prefetch a whole floor while the map loads).
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/auth";
import type { OwnedResearchMap } from "@/lib/api/researchMap";
import type { LLMProvider } from "@/lib/llm";
import { pickAttackType, type AttackType } from "@/lib/planner/attackType";
import {
  attackTypesForLevel,
  maxQuestionWordsForLevel,
  monsterLevelFor,
  type MonsterLevel,
} from "@/lib/planner/difficulty";
import { BOSS_ROSTER, MINION_ROSTER, getMonsterDisplayName } from "@/lib/monsters";
import { z } from "zod";
import {
  PROMPT_VERSION,
  QUESTIONER_SYSTEM,
  buildQuestionBatchPrompt,
} from "@/lib/prompts/questioner_v1";
import { retrieveChunks } from "@/lib/rag/retrieve";
import { RUBRICS } from "@/lib/rubrics";
import { pickTargetCriteria, type GeneratedQuestion } from "@/lib/encounter/schema";
import { checkQuestionQuality, templateQuestion } from "@/lib/encounter/questionQuality";
import type { RagRpcClient } from "@/lib/rag/types";
import type { WeaknessType } from "@/lib/domain/types";

type Admin = SupabaseClient;
type MapRow = OwnedResearchMap["map"];

export interface GenerateQuestionsInput {
  admin: Admin;
  map: MapRow;
  provider: LLMProvider;
  bossSlug: string;
  weaknessType: string;
  isBoss: boolean;
  floorOrder: number;
  roomOrder: number;
  findingId?: string;
  evidenceQuote?: string;
  previousQuestions?: string[];
  previousAttackTypes?: AttackType[];
  count: number;
}

const BATCH_SCHEMA = z.object({ questions: z.array(z.string().max(600)).max(8) });

export function personaFor(bossSlug: string): string {
  const boss = BOSS_ROSTER[bossSlug];
  if (boss) return `${boss.name} — ${boss.title}. ${boss.lore}`;
  if (bossSlug.startsWith("minion-")) {
    const minion = MINION_ROSTER.find((item) => `minion-${item.slug}` === bossSlug);
    if (minion) return `${minion.name} (${minion.character}). ${minion.lore}`;
  }
  return getMonsterDisplayName(bossSlug);
}

/**
 * Generate `count` questions for one encounter, rotating attack types and
 * feeding previous questions back into the prompt so the set stays distinct.
 */
export async function generateEncounterQuestions(
  input: GenerateQuestionsInput,
): Promise<GeneratedQuestion[]> {
  const { admin, map, provider } = input;
  const count = Math.max(1, input.count);

  let finding: { weakness_type: string; evidence_quote: string } | null = null;
  if (input.findingId) {
    const { data, error } = await admin
      .from("findings")
      .select("research_map_id, weakness_type, evidence_quote")
      .eq("id", input.findingId)
      .maybeSingle();
    if (error) throw new ApiError(error.message, 500);
    if (!data || data.research_map_id !== map.id) {
      throw new ApiError("Temuan tidak ditemukan.", 404);
    }
    finding = data;
  }

  const { data: claims, error: claimsError } = await admin
    .from("claims")
    .select("kind, text, source_quote, position")
    .eq("research_map_id", map.id)
    .order("position");
  if (claimsError) throw new ApiError(claimsError.message, 500);

  const weaknessType = finding?.weakness_type ?? input.weaknessType;
  const focusClaim =
    claims?.find((claim) => claim.kind === "conclusion") ??
    claims?.find((claim) => claim.kind === "rq") ??
    claims?.[0];
  let evidenceQuote =
    finding?.evidence_quote ||
    input.evidenceQuote ||
    focusClaim?.source_quote ||
    focusClaim?.text ||
    map.source_text.slice(0, 1200);

  // Nyxara's floor is about the injected fake reference, not a normal finding.
  if (weaknessType === "citation_claim_mismatch" || weaknessType === "citation_not_found") {
    const { data: ghost } = await admin
      .from("citations")
      .select("raw_text")
      .eq("research_map_id", map.id)
      .eq("is_injected", true)
      .maybeSingle();
    if (ghost?.raw_text) evidenceQuote = ghost.raw_text;
  }

  const summary =
    (claims ?? [])
      .slice(0, 40)
      .map((claim) => `- ${claim.kind}: ${claim.text}`)
      .join("\n") || map.source_text.slice(0, 4000);

  const { data: weakness, error: weaknessError } = await admin
    .from("weakness_types")
    .select("attack_types")
    .eq("slug", weaknessType)
    .maybeSingle();
  if (weaknessError) throw new ApiError(weaknessError.message, 500);

  const rawAllowed = ((weakness?.attack_types ?? []) as AttackType[]).filter(Boolean);
  if (rawAllowed.length === 0) {
    throw new ApiError("Tipe kelemahan belum punya bentuk serangan.", 422);
  }

  const level = monsterLevelFor({
    floorOrder: input.floorOrder,
    roomOrder: input.roomOrder,
    isBoss: input.isBoss,
    bossSlug: input.bossSlug,
  });
  const allowed = attackTypesForLevel(rawAllowed, level);
  const rubricCriteria = RUBRICS[weaknessType as WeaknessType];
  if (!rubricCriteria) throw new ApiError(`Unknown weaknessType: ${weaknessType}`, 400);

  const retrieval = await retrieveChunks(admin as unknown as RagRpcClient, {
    manuscriptId: map.manuscript_id,
    version: map.version,
    query: [evidenceQuote, weaknessType].filter(Boolean).join(" "),
    limit: 4,
  });
  const contextChunks = retrieval.chunks.map((chunk) => ({
    section: chunk.sectionLabel,
    text: chunk.text,
  }));

  const previousQuestions = [...(input.previousQuestions ?? [])];
  const usedAttacks = [...(input.previousAttackTypes ?? [])];
  const maxWords = maxQuestionWordsForLevel(level);
  const questions: GeneratedQuestion[] = [];

  // Plan every slot first (attack form + criteria are decided by code), then
  // ask for all the texts in one call instead of one call per question.
  const slots: Array<{ attackType: AttackType; targetCriteria: ReturnType<typeof pickTargetCriteria> }> = [];
  for (let index = 0; index < count; index += 1) {
    const attackType = pickAttackType(allowed, usedAttacks, usedAttacks.at(-1), 0);
    slots.push({ attackType, targetCriteria: pickTargetCriteria(rubricCriteria, attackType, input.isBoss) });
    usedAttacks.push(attackType);
  }
  const bossPersona = personaFor(input.bossSlug);

  let drafts: string[] = [];
  try {
    const raw = await provider.completeJson(
      QUESTIONER_SYSTEM,
      buildQuestionBatchPrompt({
        evidenceQuote,
        weaknessType,
        bossPersona,
        researchMapSummary: summary,
        previousQuestions,
        contextChunks,
        monsterLevel: level,
        slots,
      }),
      0.3,
    );
    const parsed = BATCH_SCHEMA.safeParse(raw);
    if (parsed.success) drafts = parsed.data.questions;
  } catch {
    // Fall through: every slot is retried on its own, then templated.
  }

  for (const [index, slot] of slots.entries()) {
    const { attackType, targetCriteria } = slot;
    const check = (question: string) =>
      checkQuestionQuality({
        question,
        targetCriteria,
        evidenceQuote,
        sourceText: map.source_text,
        previousQuestions,
        maxWords,
      });

    let question = (drafts[index] ?? "").trim();
    let quality = question ? check(question) : { ok: false as const, repair: "Tulis satu pertanyaan." };
    if (!quality.ok) {
      try {
        question = await provider.generateQuestion({
          evidenceQuote,
          weaknessType,
          attackType,
          bossPersona,
          researchMapSummary: summary,
          previousQuestions: [...previousQuestions, quality.repair],
          targetCriteria,
          contextChunks,
          monsterLevel: level,
        });
        quality = check(question);
      } catch {
        quality = { ok: false as const, repair: "" };
      }
    }
    const source = quality.ok ? "llm" : "template";
    if (!quality.ok) question = templateQuestion(attackType, targetCriteria);

    const trimmed = question.trim();
    questions.push({
      questionId: randomUUID(),
      question: trimmed,
      attackType,
      weaknessType,
      targetCriterionIds: targetCriteria.map((criterion) => criterion.id),
      level,
      promptVersion: PROMPT_VERSION,
      model: source === "llm" ? provider.modelName : "template",
    });
    previousQuestions.push(trimmed);
  }

  return questions;
}
