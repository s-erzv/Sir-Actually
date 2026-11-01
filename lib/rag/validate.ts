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

export function quoteInChunks(quote: string, chunks: readonly RetrievedChunk[] | readonly { text: string }[]): boolean {
  const target = normalizeForMatch(quote);
  if (!target) return false;
  return chunks.some((chunk) => normalizeForMatch(chunk.text).includes(target));
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
