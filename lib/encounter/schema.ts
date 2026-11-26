/**
 * lib/encounter/schema.ts — single source of truth for the encounter contract.
 *
 * One encounter question binds four things that must never drift apart:
 *
 *   weaknessType → rubric criteria → target criteria → question text
 *
 * The Questioner is told which criteria it attacks. The Judge receives the same
 * question and the same target criteria, so the player is scored for what was
 * actually asked — not for every criterion in the rubric.
 */

import { z } from "zod";
import type { RubricCriterion } from "@/lib/domain/types";
import type { AttackType } from "@/lib/planner/attackType";
import { MAX_ANSWER_LENGTH } from "@/lib/balance";

export const ATTACK_TYPE_VALUES = [
  "clarify",
  "challenge",
  "counterexample",
  "numbers",
  "limitation",
  "spot",
  "scenario",
  "repair",
] as const;

export const AttackTypeSchema = z.enum(ATTACK_TYPE_VALUES);

/** A question may target 1 criterion (minion) or 2 (boss). */
export const TargetCriterionIdsSchema = z.array(z.string().min(1)).min(1).max(2);

export const EncounterQuestionSchema = z.object({
  questionId: z.string().min(8),
  encounterId: z.string().min(1),
  weaknessType: z.string().min(1),
  attackType: AttackTypeSchema,
  targetCriterionIds: TargetCriterionIdsSchema,
  question: z.string().min(1).max(600),
  evidenceQuote: z.string().max(4000),
  level: z.number().int().min(1).max(3),
  promptVersion: z.string().min(1),
  model: z.string().min(1),
});

export type EncounterQuestion = z.infer<typeof EncounterQuestionSchema>;

/** One ready-to-play question produced ahead of time by the Questioner. */
export const GeneratedQuestionSchema = z.object({
  questionId: z.string().min(8),
  question: z.string().min(1).max(600),
  attackType: AttackTypeSchema,
  weaknessType: z.string().min(1),
  targetCriterionIds: TargetCriterionIdsSchema,
  level: z.number().int().min(1).max(3),
  promptVersion: z.string().min(1),
  model: z.string().min(1),
});

export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export const JudgeCriterionOutputSchema = z.object({
  id: z.string().min(1),
  level: z.number().int().min(0).max(2),
  quote: z.string(),
});

/**
 * `addressed` is the fairness signal: did the answer actually engage the
 * question that was asked? Heart loss is based on this, not on a low score
 * alone. A weak-but-honest answer should cost HP, not a Heart.
 */
export const JudgeOutputSchema = z.object({
  criteria: z.array(JudgeCriterionOutputSchema).min(1).max(8),
  missing: z.string().min(1).max(600),
  addressed: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
  verdict: z.enum(["answers", "thin", "off_topic", "nonsense"]).optional(),
});

export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;

export const AnswerRequestSchema = z.object({
  encounterId: z.string().min(1),
  /** Stable per-room key; used for idempotent point/loot awards. */
  encounterKey: z.string().min(1).max(120).optional(),
  researchMapId: z.string().uuid(),
  /** Server owns encounter state; the run is now required. */
  runId: z.string().uuid(),
  findingId: z.string().uuid().optional(),
  weaknessType: z.string().min(1),
  bossSlug: z.string().min(1).max(80),
  answer: z.string().min(1).max(MAX_ANSWER_LENGTH),
  evidenceQuote: z.string().max(4000).optional(),
  /** The exact question the player answered. Sent so the Judge can check it. */
  question: z.string().max(600).optional(),
  attackType: z.string().max(40).optional(),
  targetCriterionIds: z.array(z.string().min(1)).max(2).optional(),
  isBoss: z.boolean(),
  floorOrder: z.number().int().min(1).max(12),
  roomOrder: z.number().int().min(0).max(40),
  characterSlug: z.string().max(80).optional(),
  weaponSlug: z.string().max(80).optional(),
  /** Legacy client state; ignored by the server. */
  hp: z.number().int().min(0).optional(),
  hearts: z.number().int().min(0).optional(),
  questionsAsked: z.number().int().min(0).optional(),
});

export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;

/**
 * Deterministic fallback mapping from attack type to rubric criterion index.
 * Used only when the Planner cannot pick a criterion dynamically.
 */
const ATTACK_CRITERION_INDEX: Record<AttackType, number[]> = {
  clarify: [0],
  spot: [0],
  numbers: [1, 2, 0],
  challenge: [1],
  counterexample: [1, 2],
  limitation: [2],
  scenario: [2],
  repair: [1, 2],
};

const NUMBER_KEYWORDS = ["number", "angka", "statistik", "sample_size", "size", "sampel"];

function numberCriterionIndex(criteria: readonly RubricCriterion[]): number {
  const found = criteria.findIndex((criterion) =>
    NUMBER_KEYWORDS.some(
      (keyword) =>
        criterion.id.toLowerCase().includes(keyword) ||
        criterion.label.toLowerCase().includes(keyword),
    ),
  );
  return found >= 0 ? found : 1;
}

/**
 * Pick the rubric criteria a question attacks. Deterministic for the same
 * weakness + attack type + monster kind, so question generation and judging
 * can never disagree.
 */
export function pickTargetCriteria(
  criteria: readonly RubricCriterion[],
  attackType: AttackType,
  isBoss: boolean,
): RubricCriterion[] {
  if (criteria.length === 0) return [];

  const wanted =
    attackType === "numbers"
      ? [numberCriterionIndex(criteria), ...ATTACK_CRITERION_INDEX.numbers]
      : (ATTACK_CRITERION_INDEX[attackType] ?? [0]);
  const maxTargets = Math.min(isBoss ? 2 : 1, criteria.length);

  const picked: RubricCriterion[] = [];
  for (const index of wanted) {
    const criterion = criteria[index];
    if (criterion && !picked.some((item) => item.id === criterion.id)) {
      picked.push(criterion);
    }
    if (picked.length >= maxTargets) break;
  }

  return picked.length > 0 ? picked : [criteria[0]!];
}
