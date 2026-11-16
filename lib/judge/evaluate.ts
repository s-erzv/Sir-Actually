/**
 * evaluate.ts — the whole Judge pipeline as one function, so the route and the
 * live calibration test score an answer the exact same way.
 *
 *   careless guard (code) → LLM Judge → quote validator → rules → Heart
 */

import type { LLMProvider } from "@/lib/llm";
import type {
  JudgeRawOutput,
  RubricCriterion,
  RuleCap,
  ValidatedScore,
  WeaknessType,
} from "@/lib/domain/types";
import { detectCarelessAnswer } from "./careless";
import { computeHeartLoss } from "./damage";
import { applyRules } from "./rules";
import { validateQuotes } from "./validateQuotes";

export interface EvaluateInput {
  playerAnswer: string;
  question?: string;
  evidenceQuote: string;
  weaknessType: WeaknessType;
  targetCriteria: RubricCriterion[];
  sourceText: string;
  knownCitations: string[];
  contextChunks?: Array<{ section: string | null; text: string }>;
}

export interface EvaluateResult {
  scores: ValidatedScore[];
  caps: RuleCap[];
  scoreTotal: number;
  missing: string;
  addressed: boolean | undefined;
  heartLost: boolean;
  rawOutput: JudgeRawOutput;
  /** "code" when the careless guard answered without calling the LLM. */
  judgedBy: "llm" | "code";
}

export async function evaluateAnswer(
  provider: LLMProvider,
  input: EvaluateInput,
): Promise<EvaluateResult> {
  const rubricIds = input.targetCriteria.map((criterion) => criterion.id);

  const careless = detectCarelessAnswer(input.playerAnswer);
  if (careless) {
    const rawOutput: JudgeRawOutput = {
      criteria: rubricIds.map((id) => ({ id, level: 0, quote: "" })),
      missing: careless,
      addressed: false,
      verdict: "nonsense",
    };
    return {
      scores: rubricIds.map((id) => ({ criterionId: id, level: 0, quote: "", capApplied: false })),
      caps: [],
      scoreTotal: 0,
      missing: careless,
      addressed: false,
      heartLost: true,
      rawOutput,
      judgedBy: "code",
    };
  }

  const rawOutput = await provider.judgeAnswer({
    playerAnswer: input.playerAnswer,
    question: input.question,
    evidenceQuote: input.evidenceQuote,
    weaknessType: input.weaknessType,
    rubricCriteria: input.targetCriteria,
    previousQuestions: [],
    contextChunks: input.contextChunks,
  });

  // The verdict is the fairness signal. Anything that engages the question
  // keeps the Heart, even when it is thin; only empty or off-topic answers
  // lose one.
  const addressed =
    rawOutput.verdict !== undefined
      ? rawOutput.verdict === "answers" || rawOutput.verdict === "thin"
      : (rawOutput.addressed ?? (input.question ? true : undefined));

  const validated = validateQuotes(rawOutput, input.playerAnswer, rubricIds).map((score) =>
    // An answer that does not engage the question cannot earn credit for it.
    addressed === false ? { ...score, level: 0 as const } : score,
  );

  const { scores, caps } = applyRules(validated, {
    playerAnswer: input.playerAnswer,
    sourceText: input.sourceText,
    weaknessType: input.weaknessType,
    knownCitations: input.knownCitations,
  });

  const scoreTotal = scores.reduce((sum, score) => sum + score.level, 0);
  return {
    scores,
    caps,
    scoreTotal,
    missing: rawOutput.missing,
    addressed,
    heartLost: computeHeartLoss(scoreTotal, addressed),
    rawOutput,
    judgedBy: "llm",
  };
}
