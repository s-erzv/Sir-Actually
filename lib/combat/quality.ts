/**
 * Answer quality 0-5, computed by code from the Judge's validated scores.
 * The Judge never sees or sets this number.
 */

import type { Quality } from "@/lib/domain/types";
import { QUALITY_LABELS } from "@/lib/balance";
import { hasSixWordQuote, mentionsCitation, mentionsSourceNumber } from "@/lib/loadout";

/**
 * Surface check: did the answer lean on the manuscript itself? It looks at
 * the text only and never changes a criterion level.
 */
export function usesManuscriptEvidence(
  answer: string,
  sourceText: string,
  citations: readonly string[],
): boolean {
  return (
    hasSixWordQuote(answer, sourceText) ||
    mentionsSourceNumber(answer, sourceText) ||
    mentionsCitation(answer, citations)
  );
}

export function answerQuality(input: {
  scoreTotal: number;
  scoreMax: number;
  addressed: boolean | undefined;
  usedEvidence: boolean;
}): Quality {
  if (input.addressed === false || input.scoreMax <= 0 || input.scoreTotal <= 0) return 0;
  const ratio = Math.min(1, input.scoreTotal / input.scoreMax);
  const base = ratio >= 1 ? 4 : ratio >= 0.75 ? 3 : ratio >= 0.5 ? 2 : 1;
  // Evidence lifts a real answer one step; it cannot rescue a scratch.
  return (base >= 2 && input.usedEvidence ? base + 1 : base) as Quality;
}

export function qualityLabel(quality: Quality): string {
  return QUALITY_LABELS[quality];
}
