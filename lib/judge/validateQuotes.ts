/**
 * validateQuotes — step 2 of the Judge pipeline.
 *
 * Takes raw LLM Judge output and the player's answer, and returns
 * ValidatedScore[] with levels set to 0 wherever the quote is invalid.
 *
 * Rules:
 * - Only criteria that appear in rubricIds are kept (extras are discarded).
 * - Criteria in rubricIds but absent from raw.criteria → level 0, quote "".
 * - Quote must come from the player's answer. Exact substring first; then a
 *   match that ignores case and punctuation; then the answer sentence that
 *   shares most of the quote's words. Judges often tidy a quote, and a good
 *   answer must not score 0 for that. The stored quote is always real text
 *   from the answer.
 * - A quote with no anchor in the answer → level forced to 0.
 * - Empty quote → level forced to 0.
 * - capApplied is always false here (rules engine sets it later).
 */

import type { JudgeRawOutput, ValidatedScore } from "@/lib/domain/types";

/** Normalize whitespace: trim + collapse multiple spaces/newlines to one space. */
export function normalizeWs(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Share of the quote's words that must appear in one answer sentence. */
const SENTENCE_OVERLAP_MIN = 0.7;

/**
 * Find the text in the answer that a Judge quote refers to. Returns real
 * answer text, or null when the quote was not said by the player.
 */
export function anchorQuote(quote: string, normalizedAnswer: string): string | null {
  if (normalizedAnswer.includes(quote)) return quote;

  const quoteTokens = tokens(quote);
  if (quoteTokens.length === 0) return null;

  // Same words in the same order, ignoring case and punctuation.
  const answerTokens = tokens(normalizedAnswer);
  const needle = quoteTokens.join(" ");
  if (` ${answerTokens.join(" ")} `.includes(` ${needle} `)) {
    const sentence = bestSentence(quoteTokens, normalizedAnswer);
    return sentence?.text ?? normalizedAnswer;
  }

  // Tidied or lightly paraphrased quote: accept the sentence it came from.
  if (quoteTokens.length < 3) return null;
  const sentence = bestSentence(quoteTokens, normalizedAnswer);
  return sentence && sentence.overlap >= SENTENCE_OVERLAP_MIN ? sentence.text : null;
}

function bestSentence(
  quoteTokens: string[],
  normalizedAnswer: string,
): { text: string; overlap: number } | null {
  const sentences = normalizedAnswer.split(/(?<=[.!?;])\s+/).filter(Boolean);
  let best: { text: string; overlap: number } | null = null;
  for (const text of sentences) {
    const bag = new Set(tokens(text));
    const overlap = quoteTokens.filter((token) => bag.has(token)).length / quoteTokens.length;
    if (!best || overlap > best.overlap) best = { text, overlap };
  }
  return best;
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

    const anchored = anchorQuote(quote, normalizedAnswer);
    if (!anchored) {
      // Quote has no anchor in the answer → level 0
      return { criterionId: id, level: 0, quote: "", capApplied: false };
    }

    return {
      criterionId: id,
      level: rawCriterion.level,
      quote: anchored,
      capApplied: false,
    };
  });
}
