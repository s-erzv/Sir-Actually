import { z } from "zod";
import type { LLMProvider } from "@/lib/llm";
import { DOCUMENT_KIND_SYSTEM, buildDocumentKindPrompt } from "@/lib/prompts/documentKind_v1";

/**
 * Upload gate: is this document a paper at all? Messy structure never blocks.
 *
 * - >= STRONG_STRUCTURE_SECTIONS known sections found: accept, no LLM call.
 * - Otherwise the LLM classifies the opening of the document:
 *   research -> accept; not_research with <= 1 section -> reject;
 *   anything else (unclear, not_research with 2 sections, LLM failure) ->
 *   the player decides.
 */
export const STRONG_STRUCTURE_SECTIONS = 3;
const CLASSIFY_EXCERPT_CHARS = 8_000;

export type DocumentKind = "research" | "unclear" | "not_research";

export interface DocumentVerdict {
  kind: DocumentKind;
  reason: string;
}

export type GateDecision =
  | { action: "accept"; verdict: DocumentVerdict | null }
  | { action: "confirm"; verdict: DocumentVerdict | null }
  | { action: "reject"; verdict: DocumentVerdict };

const VERDICT_SCHEMA = z.object({
  kind: z.enum(["research", "unclear", "not_research"]),
  reason: z.string().trim().min(1).max(500),
});

export function needsClassification(sectionsFound: number): boolean {
  return sectionsFound < STRONG_STRUCTURE_SECTIONS;
}

/** Pure decision; `verdict` is null when the LLM was skipped or failed. */
export function decideGate(sectionsFound: number, verdict: DocumentVerdict | null): GateDecision {
  if (!needsClassification(sectionsFound)) return { action: "accept", verdict };
  if (verdict?.kind === "research") return { action: "accept", verdict };
  if (verdict?.kind === "not_research" && sectionsFound <= 1) return { action: "reject", verdict };
  return { action: "confirm", verdict };
}

/** Returns null on any LLM or schema failure: a broken classifier must not block. */
export async function classifyDocument(
  provider: LLMProvider,
  sourceText: string,
): Promise<DocumentVerdict | null> {
  try {
    const raw = await provider.completeJson(
      DOCUMENT_KIND_SYSTEM,
      buildDocumentKindPrompt(sourceText.slice(0, CLASSIFY_EXCERPT_CHARS)),
      0,
    );
    const parsed = VERDICT_SCHEMA.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    console.error("[document-gate]", error);
    return null;
  }
}
