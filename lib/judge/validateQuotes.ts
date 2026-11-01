/**
 * validateQuotes — step 2 of the Judge pipeline.
 *
 * Takes raw LLM Judge output and the player's answer, and returns
 * ValidatedScore[] with levels set to 0 wherever the quote is invalid.
 *
 * Rules:
 * - Only criteria that appear in rubricIds are kept (extras are discarded).
 * - Criteria in rubricIds but absent from raw.criteria → level 0, quote "".
 * - Quote must be a substring of the player's answer after whitespace normalization.
 *   If not → level forced to 0.
 * - Empty quote → level forced to 0.
 * - capApplied is always false here (rules engine sets it later).
 */

import type { JudgeRawOutput, ValidatedScore } from "@/lib/domain/types";

/** Normalize whitespace: trim + collapse multiple spaces/newlines to one space. */
export function normalizeWs(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function validateQuotes(
  raw: JudgeRawOutput,
  playerAnswer: string,
  rubricIds: string[],
): ValidatedScore[] {
  const normalizedAnswer = normalizeWs(playerAnswer);

  // Index raw output by criterion id for O(1) lookup
  const rawById = new Map(raw.criteria.map((c) => [c.id, c]));

  return rubricIds.map((id): ValidatedScore => {
    const rawCriterion = rawById.get(id);

    if (!rawCriterion) {
      // Judge did not return this criterion → level 0
      return { criterionId: id, level: 0, quote: "", capApplied: false };
    }

    const quote = normalizeWs(rawCriterion.quote);

    if (!quote) {
      // Empty quote → level 0
      return { criterionId: id, level: 0, quote: "", capApplied: false };
    }

    if (!normalizedAnswer.includes(quote)) {
      // Quote is not a substring of the answer → level 0
      return { criterionId: id, level: 0, quote: "", capApplied: false };
    }

    return {
      criterionId: id,
      level: rawCriterion.level,
      quote,
      capApplied: false,
    };
  });
}
