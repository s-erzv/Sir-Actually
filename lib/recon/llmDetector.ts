import { z } from "zod";
import type { LLMProvider } from "@/lib/llm";
import {
  FINDINGS_SYSTEM,
  MAX_FINDINGS_PER_DIMENSION,
  PROMPT_VERSION,
  RECON_DIMENSIONS,
  RECON_WEAKNESS_TYPES,
  SPECIALISTS,
  buildFindingsPrompt,
  type ReconDimension,
} from "@/lib/prompts/findings_v1";
import type { ClaimInput, CodeFindingDraft } from "./codeDetectors";
import { quoteInChunks } from "@/lib/rag/validate";

const OUTPUT_SCHEMA = z.object({
  findings: z
    .array(
      z.object({
        claim_index: z.coerce.number().int().min(-1).max(50).catch(-1),
        weakness_type: z.string(),
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

type Chunk = { section: string | null; text: string };

export interface LlmFindingInput {
  claims: ClaimInput[];
  citations: string[];
  /** Fallback slice of the manuscript for dimensions without their own. */
  chunks: Chunk[];
  /** Manuscript slice per specialist; this is what makes each call focused. */
  dimensionChunks?: Partial<Record<ReconDimension, Chunk[]>>;
  alreadyDetected: Array<{ weaknessType: string; evidenceQuote: string }>;
}

export interface LlmFindingResult {
  findings: LlmFindingDraft[];
  promptVersion: string;
  /** Distinct findings dropped because their quote is not in the manuscript. */
  discarded: number;
  /** Specialists whose call failed; the others still count. */
  failedDimensions: ReconDimension[];
  timings: Partial<Record<ReconDimension, number>>;
}

const KNOWN_TYPES = new Set<string>(RECON_WEAKNESS_TYPES);
/** Below this the Judge of the manuscript is guessing; not worth a monster. */
const MIN_CONFIDENCE = 0.45;

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Four specialists read the manuscript in parallel, one per dimension. Every
 * finding must quote the slice its specialist was given.
 */
export async function detectLlmFindings(
  provider: LLMProvider,
  input: LlmFindingInput,
): Promise<LlmFindingResult> {
  const indexedClaims = input.claims.map((claim, index) => ({
    index,
    kind: claim.kind,
    text: claim.text,
    quote: claim.sourceQuote ?? "",
  }));
  const timings: LlmFindingResult["timings"] = {};

  const runs = RECON_DIMENSIONS.map(async (dimension) => {
    const chunks = input.dimensionChunks?.[dimension] ?? input.chunks;
    if (chunks.length === 0) return { dimension, chunks, findings: [] };
    const kinds = SPECIALISTS[dimension].claimKinds;
    const started = Date.now();
    const raw = await provider.completeJson(
      FINDINGS_SYSTEM,
      buildFindingsPrompt({
        dimension,
        claims: indexedClaims.filter((claim) => kinds.includes(claim.kind)).slice(0, 16),
        citations: input.citations,
        chunks,
        alreadyDetected: input.alreadyDetected,
      }),
      0.1,
    );
    timings[dimension] = Date.now() - started;
    const parsed = OUTPUT_SCHEMA.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Output detektor ${dimension} tidak valid: ${parsed.error.issues[0]?.message ?? "skema salah"}`,
      );
    }
    return { dimension, chunks, findings: parsed.data.findings };
  });

  const settled = await Promise.allSettled(runs);
  const failedDimensions = RECON_DIMENSIONS.filter(
    (_, index) => settled[index]!.status === "rejected",
  );
  if (failedDimensions.length === RECON_DIMENSIONS.length) {
    const first = settled[0] as PromiseRejectedResult;
    throw first.reason instanceof Error ? first.reason : new Error("Detektor LLM gagal.");
  }

  const seen = new Set(
    input.alreadyDetected.map(
      (finding) => `${finding.weaknessType}|${normalize(finding.evidenceQuote).toLowerCase()}`,
    ),
  );
  const invalidQuotes = new Set<string>();
  const findings: LlmFindingDraft[] = [];

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    const { dimension, chunks } = result.value;
    const allowed = SPECIALISTS[dimension].checks;
    let kept = 0;

    for (const finding of result.value.findings) {
      // A specialist only reports its own types; anything else is drift.
      if (!KNOWN_TYPES.has(finding.weakness_type) || !(finding.weakness_type in allowed)) continue;
      if (finding.confidence < MIN_CONFIDENCE) continue;
      if (kept >= MAX_FINDINGS_PER_DIMENSION) break;

      const quote = normalize(finding.evidence_quote);
      const key = `${finding.weakness_type}|${quote.toLowerCase()}`;
      if (!quoteInChunks(quote, chunks)) {
        invalidQuotes.add(key);
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);

      const claim = input.claims[finding.claim_index] ?? null;
      const cap = claim && ["rq", "finding", "conclusion"].includes(claim.kind) ? 3 : 2;
      const severity = Math.min(finding.severity, cap) as 1 | 2 | 3;

      findings.push({
        weaknessType: finding.weakness_type as LlmFindingDraft["weaknessType"],
        claimId: claim?.id ?? null,
        severity,
        centrality: finding.centrality as 1 | 2 | 3,
        confidence: finding.confidence,
        evidenceQuote: finding.evidence_quote.trim(),
        detector: "llm",
        rationale: finding.rationale?.trim() || "Temuan dari analisis LLM.",
      });
      kept++;
    }
  }

  return {
    findings,
    promptVersion: PROMPT_VERSION,
    discarded: invalidQuotes.size,
    failedDimensions,
    timings,
  };
}
