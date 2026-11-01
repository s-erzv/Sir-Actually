import { z } from "zod";
import type { LLMProvider } from "@/lib/llm";
import {
  FINDINGS_SYSTEM,
  PROMPT_VERSION,
  RECON_WEAKNESS_TYPES,
  buildFindingsPrompt,
} from "@/lib/prompts/findings_v1";
import type { ClaimInput, CodeFindingDraft } from "./codeDetectors";
import { quoteInChunks } from "@/lib/rag/validate";

const OUTPUT_SCHEMA = z.object({
  findings: z
    .array(
      z.object({
        claim_index: z.coerce.number().int().min(-1).max(50),
        weakness_type: z.enum(RECON_WEAKNESS_TYPES),
        evidence_quote: z.string().min(3).max(4000),
        severity: z.coerce.number().int().min(1).max(3),
        centrality: z.coerce.number().int().min(1).max(3),
        confidence: z.coerce.number().min(0).max(1),
        rationale: z.string().max(1000).optional(),
      }),
    )
    .max(20),
});

export type LlmFindingDraft = Omit<CodeFindingDraft, "detector"> & { detector: "llm" };

export interface LlmFindingInput {
  claims: ClaimInput[];
  citations: string[];
  chunks: Array<{ section: string | null; text: string }>;
  alreadyDetected: Array<{ weaknessType: string; evidenceQuote: string }>;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function detectLlmFindings(
  provider: LLMProvider,
  input: LlmFindingInput,
): Promise<{ findings: LlmFindingDraft[]; promptVersion: string; discarded: number }> {
  const raw = await provider.completeJson(
    FINDINGS_SYSTEM,
    buildFindingsPrompt({
      claims: input.claims.map((claim, index) => ({
        index,
        kind: claim.kind,
        text: claim.text,
        quote: claim.sourceQuote ?? "",
      })),
      citations: input.citations,
      chunks: input.chunks,
      alreadyDetected: input.alreadyDetected,
    }),
    0.1,
  );

  const parsed = OUTPUT_SCHEMA.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Output detektor LLM tidak valid: ${parsed.error.issues[0]?.message ?? "skema salah"}`,
    );
  }

  const seen = new Set(
    input.alreadyDetected.map(
      (finding) => `${finding.weaknessType}|${normalize(finding.evidenceQuote).toLowerCase()}`,
    ),
  );

  let discarded = 0;
  const findings: LlmFindingDraft[] = [];

  for (const finding of parsed.data.findings) {
    const quote = normalize(finding.evidence_quote);
    if (!quoteInChunks(quote, input.chunks)) {
      discarded++;
      continue;
    }

    const key = `${finding.weakness_type}|${quote.toLowerCase()}`;
    if (seen.has(key)) {
      discarded++;
      continue;
    }
    seen.add(key);

    const claim = input.claims[finding.claim_index] ?? null;
    const cap = claim && ["rq", "finding", "conclusion"].includes(claim.kind) ? 3 : 2;
    const severity = Math.min(finding.severity, cap) as 1 | 2 | 3;

    findings.push({
      weaknessType: finding.weakness_type,
      claimId: claim?.id ?? null,
      severity,
      centrality: finding.centrality as 1 | 2 | 3,
      confidence: finding.confidence,
      evidenceQuote: finding.evidence_quote.trim(),
      detector: "llm",
      rationale: finding.rationale?.trim() || "Temuan dari analisis LLM.",
    });
  }

  return { findings, promptVersion: PROMPT_VERSION, discarded };
}
