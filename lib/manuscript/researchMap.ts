import { z } from "zod";
import type { ClaimKind } from "@/lib/supabase/database";
import type { LLMProvider } from "@/lib/llm";
import {
  PROMPT_VERSION,
  RESEARCH_MAP_SYSTEM,
  buildResearchMapPrompt,
} from "@/lib/prompts/researchMap_v1";
import { parseBibliography } from "./completeness";

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

function manuscriptExcerpt(sourceText: string): string {
  if (sourceText.length <= MAX_PROMPT_CHARS) return sourceText;
  const head = sourceText.slice(0, MAX_PROMPT_CHARS - TAIL_CHARS);
  const tail = sourceText.slice(-TAIL_CHARS);
  return `${head}\n\n[... BAGIAN TENGAH NASKAH DIPOTONG UNTUK BATAS KONTEKS ...]\n\n${tail}`;
}

export async function extractResearchMap(
  provider: LLMProvider,
  sourceText: string,
): Promise<ResearchMapExtraction> {
  const raw = await provider.completeJson(
    RESEARCH_MAP_SYSTEM,
    buildResearchMapPrompt(manuscriptExcerpt(sourceText)),
    0.1,
  );
  const parsed = CLAIM_SCHEMA.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Output Research Map tidak valid: ${parsed.error.issues[0]?.message ?? "skema salah"}`,
    );
  }

  const source = normalize(sourceText);
  let discardedQuotes = 0;
  const claims: ExtractedClaim[] = [];
  const seenText = new Set<string>();
  const seenQuotes = new Set<string>();

  for (const claim of parsed.data.claims) {
    const quote = normalize(claim.source_quote);
    const text = normalize(claim.text);
    if (!source.includes(quote)) {
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
