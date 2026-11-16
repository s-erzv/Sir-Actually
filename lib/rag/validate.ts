import type { RetrievedChunk } from "./types";

export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
    .toLowerCase();
}

/** Normalize punctuation away so a model's punctuation drift still matches. */
function normalizeLoose(text: string): string {
  return normalizeForMatch(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when the quote is present, accepting harmless punctuation differences
 * (quotation marks, commas, ellipses) that models routinely introduce.
 */
export function quoteInText(quote: string, text: string): boolean {
  const target = normalizeForMatch(quote);
  if (!target) return false;
  if (normalizeForMatch(text).includes(target)) return true;
  const looseTarget = normalizeLoose(quote);
  if (!looseTarget) return false;
  return normalizeLoose(text).includes(looseTarget);
}

export function quoteInChunks(quote: string, chunks: readonly RetrievedChunk[] | readonly { text: string }[]): boolean {
  const target = normalizeForMatch(quote);
  if (!target) return false;
  return chunks.some((chunk) => quoteInText(quote, chunk.text));
}

export function dedupeChunks(chunks: readonly RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Set<string>();
  const result: RetrievedChunk[] = [];
  for (const chunk of chunks) {
    const key = chunk.id || `${chunk.chunkIndex}:${chunk.text.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(chunk);
  }
  return result;
}
