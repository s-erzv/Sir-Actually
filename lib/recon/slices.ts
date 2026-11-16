/**
 * slices.ts — choose which part of the manuscript each specialist reads.
 *
 * Pure and deterministic: no embeddings, no database. A chunk is relevant to a
 * dimension when it holds the source quote of a claim that dimension cares
 * about, or sits under a matching section heading.
 */

import type { ManuscriptChunk } from "@/lib/manuscript/chunk";
import { SPECIALISTS, RECON_DIMENSIONS, type ReconDimension } from "@/lib/prompts/findings_v1";
import { normalizeForMatch } from "@/lib/rag/validate";

const SECTION_HINTS: Record<ReconDimension, RegExp> = {
  gap: /pendahuluan|latar|background|introduction|tinjauan|kajian|pustaka|literatur|literature|landasan|teori|terdahulu|related work/i,
  align: /pendahuluan|latar|rumusan|tujuan|masalah|pertanyaan|objective|research question|introduction|background/i,
  method: /metod|method|sampel|sample|populasi|population|teknik|prosedur|instrumen|analisis data|keterbatasan|limitation/i,
  audit: /abstra|hasil|pembahasan|result|finding|discussion|kesimpulan|simpulan|conclusion|penutup|saran|tujuan/i,
};

const REFERENCE_SECTION = /daftar pustaka|referensi|references|bibliograf|daftar rujukan|lampiran|appendix/i;

/** About 6k tokens per specialist: enough context, still a fast call. */
export const SLICE_CHAR_BUDGET = 24_000;

export function sliceForDimensions(
  chunks: readonly ManuscriptChunk[],
  claims: ReadonlyArray<{ kind: string; sourceQuote?: string | null }>,
  budget = SLICE_CHAR_BUDGET,
): Record<ReconDimension, ManuscriptChunk[]> {
  const body = chunks.filter((chunk) => !REFERENCE_SECTION.test(chunk.sectionLabel ?? ""));
  const normalized = body.map((chunk) => normalizeForMatch(chunk.text));
  const result = {} as Record<ReconDimension, ManuscriptChunk[]>;

  for (const dimension of RECON_DIMENSIONS) {
    const kinds = SPECIALISTS[dimension].claimKinds;
    const quotes = claims
      .filter((claim) => kinds.includes(claim.kind) && claim.sourceQuote)
      .map((claim) => normalizeForMatch(claim.sourceQuote!).slice(0, 120))
      .filter((quote) => quote.length >= 12);

    const scored = body.map((chunk, index) => {
      const holdsClaim = quotes.some((quote) => normalized[index]!.includes(quote));
      const inSection = SECTION_HINTS[dimension].test(chunk.sectionLabel ?? "");
      return { chunk, index, score: (holdsClaim ? 3 : 0) + (inSection ? 2 : 0) };
    });

    let ranked = scored.filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
    if (ranked.length === 0) {
      // No headings and no claim anchors: sample the body evenly.
      const step = Math.max(1, Math.floor(scored.length / 8));
      ranked = scored.filter((_, index) => index % step === 0);
    }

    const picked: typeof ranked = [];
    let used = 0;
    for (const entry of ranked) {
      const size = Math.min(entry.chunk.text.length, 2400);
      if (used + size > budget) continue;
      picked.push(entry);
      used += size;
    }
    result[dimension] = picked.sort((a, b) => a.index - b.index).map((entry) => entry.chunk);
  }

  return result;
}
