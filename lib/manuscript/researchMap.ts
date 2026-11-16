import { z } from "zod";
import type { ClaimKind } from "@/lib/supabase/database";
import type { LLMProvider } from "@/lib/llm";
import {
  PROMPT_VERSION,
  RESEARCH_MAP_SYSTEM,
  buildResearchMapPrompt,
} from "@/lib/prompts/researchMap_v1";
import { parseBibliography } from "./completeness";
import { quoteInText } from "@/lib/rag/validate";

const CLAIM_SCHEMA = z.object({
  claims: z
    .array(
      z.object({
        kind: z.enum([
          "problem",
          "gap",
          "objective",
          "rq",
          "method",
          "finding",
          "limitation",
          "conclusion",
        ]),
        text: z.string().min(3).max(2000),
        source_quote: z.string().min(3).max(4000),
      }),
    )
    .max(40),
});

export interface ExtractedClaim {
  kind: ClaimKind;
  text: string;
  sourceQuote: string;
  position: number;
}

export interface ResearchMapExtraction {
  claims: ExtractedClaim[];
  citations: string[];
  promptVersion: string;
  discardedQuotes: number;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function citationKey(text: string): string {
  return normalize(text)
    .replace(/^\[\d+\]\s*/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function dedupeCitations(citations: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const citation of citations) {
    const key = citationKey(citation);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(citation);
  }
  return result;
}

const MAX_PROMPT_CHARS = 120_000;
const TAIL_CHARS = 40_000;
const PART_CHARS = 12_000;
const MAX_PARTS = 8;
const PART_CONCURRENCY = 4;

function manuscriptExcerpt(sourceText: string): string {
  if (sourceText.length <= MAX_PROMPT_CHARS) return sourceText;
  const head = sourceText.slice(0, MAX_PROMPT_CHARS - TAIL_CHARS);
  const tail = sourceText.slice(-TAIL_CHARS);
  return `${head}\n\n[... BAGIAN TENGAH NASKAH DIPOTONG UNTUK BATAS KONTEKS ...]\n\n${tail}`;
}

/** Split on a paragraph/sentence boundary near the target size. */
function splitParts(text: string): string[] {
  if (text.length <= PART_CHARS) return [text];
  const target = Math.min(MAX_PARTS, Math.max(2, Math.ceil(text.length / PART_CHARS)));
  const size = Math.ceil(text.length / target);
  const parts: string[] = [];
  let cursor = 0;

  while (cursor < text.length && parts.length < target) {
    const end = Math.min(text.length, cursor + size);
    if (end < text.length) {
      const slice = text.slice(cursor, end);
      const boundary = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("\n"),
        slice.lastIndexOf(". "),
      );
      if (boundary > size * 0.5) {
        parts.push(text.slice(cursor, cursor + boundary + 1));
        cursor += boundary + 1;
        continue;
      }
    }
    parts.push(text.slice(cursor, end));
    cursor = end;
  }

  if (cursor < text.length) parts[parts.length - 1] += text.slice(cursor);
  return parts.filter((part) => part.trim().length > 0);
}

export async function extractResearchMap(
  provider: LLMProvider,
  sourceText: string,
): Promise<ResearchMapExtraction> {
  const parts = splitParts(manuscriptExcerpt(sourceText));
  const settled: PromiseSettledResult<unknown>[] = [];

  // Bounded parallelism keeps each LLM call small enough to beat the timeout.
  for (let index = 0; index < parts.length; index += PART_CONCURRENCY) {
    const batch = parts.slice(index, index + PART_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((part, offset) =>
        provider.completeJson(
          RESEARCH_MAP_SYSTEM,
          buildResearchMapPrompt(part, {
            index: index + offset,
            total: parts.length,
          }),
          0.1,
        ),
      ),
    );
    settled.push(...results);
  }

  const rawClaims: Array<z.infer<typeof CLAIM_SCHEMA>["claims"][number]> = [];
  for (const result of settled) {
    if (result.status === "rejected") continue;
    const parsed = CLAIM_SCHEMA.safeParse(result.value);
    if (!parsed.success) continue;
    rawClaims.push(...parsed.data.claims);
  }

  if (rawClaims.length === 0) {
    throw new Error(
      "AI tidak menghasilkan klaim yang bisa diverifikasi terhadap naskah. Coba lagi atau periksa kualitas teks.",
    );
  }

  let discardedQuotes = 0;
  const claims: ExtractedClaim[] = [];
  const seenText = new Set<string>();
  const seenQuotes = new Set<string>();

  for (const claim of rawClaims) {
    if (claims.length >= 40) break;
    const quote = normalize(claim.source_quote);
    const text = normalize(claim.text);
    if (!quoteInText(claim.source_quote, sourceText)) {
      discardedQuotes++;
      continue;
    }
    if (seenText.has(text) || seenQuotes.has(quote)) continue;
    seenText.add(text);
    seenQuotes.add(quote);
    claims.push({
      kind: claim.kind,
      text: claim.text.trim(),
      sourceQuote: claim.source_quote.trim(),
      position: claims.length,
    });
  }

  if (claims.length === 0) {
    throw new Error(
      "AI tidak menghasilkan klaim yang bisa diverifikasi terhadap naskah. Coba lagi atau periksa kualitas teks.",
    );
  }

  return {
    claims,
    citations: dedupeCitations(parseBibliography(sourceText).entries),
    promptVersion: PROMPT_VERSION,
    discardedQuotes,
  };
}
