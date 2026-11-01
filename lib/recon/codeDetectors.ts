import type { ClaimKind, ManuscriptStage } from "@/lib/supabase/database";

export interface ClaimInput {
  id: string;
  kind: ClaimKind;
  text: string;
  sourceQuote: string | null;
}

export interface CodeFindingDraft {
  weaknessType: string;
  claimId: string | null;
  severity: 1 | 2 | 3;
  centrality: 1 | 2 | 3;
  confidence: number;
  evidenceQuote: string;
  detector: "code";
  rationale: string;
}

const CITATION_MARKER = /\([^)]*\b(?:19|20)\d{2}[a-z]?\)|\[\d+\]|\bdoi\s*:?/i;
const SAMPLE_SIZE =
  /\b[nN]\s*=\s*\d+|\b\d+\s+(?:responden|partisipan|sampel|subjek|peserta|participants?|samples?|subjects?)\b/i;
const SIGNIFICANCE_CLAIM = /\b(?:signifikan|significant|terbukti|membuktikan|proves?|shows?)\b/i;

function quoteOf(claim: ClaimInput): string {
  return claim.sourceQuote?.trim() || claim.text.trim();
}

function hasCitation(claim: ClaimInput): boolean {
  return CITATION_MARKER.test(`${claim.text} ${claim.sourceQuote ?? ""}`);
}

export function detectCodeFindings(
  claims: ClaimInput[],
  stage: ManuscriptStage,
  sourceText: string,
): CodeFindingDraft[] {
  const findings: CodeFindingDraft[] = [];
  const quoteInSource = (quote: string) =>
    quote.length > 0 && sourceText.replace(/\s+/g, " ").includes(quote.replace(/\s+/g, " "));

  const push = (draft: CodeFindingDraft) => {
    if (quoteInSource(draft.evidenceQuote)) findings.push(draft);
  };

  for (const claim of claims) {
    const quote = quoteOf(claim);

    if (claim.kind === "gap" && !hasCitation(claim)) {
      push({
        weaknessType: "gap_unsupported",
        claimId: claim.id,
        severity: 2,
        centrality: 2,
        confidence: 0.7,
        evidenceQuote: quote,
        detector: "code",
        rationale: "Klaim gap tidak menyertakan penanda sitasi.",
      });
    }

    if (
      ["problem", "finding", "conclusion"].includes(claim.kind) &&
      SIGNIFICANCE_CLAIM.test(claim.text) &&
      !hasCitation(claim)
    ) {
      push({
        weaknessType: "claim_without_citation",
        claimId: claim.id,
        severity: 2,
        centrality: claim.kind === "conclusion" ? 3 : 2,
        confidence: 0.62,
        evidenceQuote: quote,
        detector: "code",
        rationale: "Klaim signifikansi/faktual tidak disertai sitasi.",
      });
    }

    if (claim.kind === "method" && !SAMPLE_SIZE.test(`${claim.text} ${claim.sourceQuote ?? ""}`)) {
      push({
        weaknessType: "sample_unreported",
        claimId: claim.id,
        severity: 2,
        centrality: 2,
        confidence: 0.66,
        evidenceQuote: quote,
        detector: "code",
        rationale: "Bagian metode tidak menyebut ukuran sampel (n).",
      });
    }
  }

  const limitations = claims.filter((claim) => claim.kind === "limitation");
  if (limitations.length === 0) {
    const anchor = claims.find((claim) => claim.kind === "conclusion") ??
      claims.find((claim) => claim.kind === "method") ??
      claims[0];
    if (anchor) {
      push({
        weaknessType: "limitation_missing",
        claimId: anchor.id,
        severity: 2,
        centrality: 2,
        confidence: 0.58,
        evidenceQuote: quoteOf(anchor),
        detector: "code",
        rationale: "Tidak ditemukan klaim keterbatasan penelitian.",
      });
    }
  }

  if (stage !== "proposal") {
    const objectives = claims.filter((claim) => claim.kind === "objective");
    const results = claims.filter((claim) => claim.kind === "finding");
    if (objectives.length > results.length) {
      const anchor = objectives[results.length] ?? objectives[0];
      if (anchor) {
        push({
          weaknessType: "objective_without_finding",
          claimId: anchor.id,
          severity: 2,
          centrality: 3,
          confidence: 0.6,
          evidenceQuote: quoteOf(anchor),
          detector: "code",
          rationale: `Jumlah tujuan (${objectives.length}) melebihi jumlah temuan (${results.length}).`,
        });
      }
    }
  }

  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.weaknessType}|${finding.evidenceQuote}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
