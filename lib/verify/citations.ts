import type { VerificationStatus } from "@/lib/supabase/database";

export interface CitationVerification {
  status: VerificationStatus;
  matchedWork: Record<string, unknown> | null;
  reason: string;
}

const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i;

export function extractDoi(rawText: string): string | null {
  const match = rawText.match(DOI_PATTERN);
  return match?.[0]?.replace(/[.,;]$/, "") ?? null;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8_000),
    headers: { "user-agent": "SirActually/0.1" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function verifyCitation(rawText: string): Promise<CitationVerification> {
  const doi = extractDoi(rawText);

  if (doi) {
    try {
      const data = (await fetchJson(
        `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      )) as {
        message?: {
          title?: string[];
          author?: Array<{ family?: string; given?: string }>;
          DOI?: string;
        };
      };
      const work = data.message;
      if (work?.title?.[0]) {
        return {
          status: "verified",
          matchedWork: {
            source: "crossref",
            doi: work.DOI ?? doi,
            title: work.title[0],
            authors: work.author?.map((author) =>
              [author.given, author.family].filter(Boolean).join(" "),
            ),
          },
          reason: "DOI ditemukan di Crossref.",
        };
      }
    } catch {
      // Fall through to OpenAlex.
    }
  }

  const query = rawText.slice(0, 300);
  try {
    const data = (await fetchJson(
      `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=3`,
    )) as {
      message?: {
        items?: Array<{
          score?: number;
          title?: string[];
          DOI?: string;
          author?: Array<{ family?: string; given?: string }>;
        }>;
      };
    };
    const best = data.message?.items?.[0];
    if (best?.title?.[0] && (best.score ?? 0) >= 50) {
      return {
        status: "verified",
        matchedWork: {
          source: "crossref-search",
          doi: best.DOI ?? null,
          title: best.title[0],
          authors: best.author?.map((author) =>
            [author.given, author.family].filter(Boolean).join(" "),
          ),
          score: best.score,
        },
        reason: "Kecocokan bibliografis di Crossref.",
      };
    }
  } catch {
    // Try OpenAlex.
  }

  try {
    const data = (await fetchJson(
      `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=3`,
    )) as {
      results?: Array<{
        title?: string;
        doi?: string;
        relevance_score?: number;
        authorships?: Array<{ author?: { display_name?: string } }>;
      }>;
    };
    const best = data.results?.[0];
    if (best?.title && (best.relevance_score ?? 0) >= 20) {
      return {
        status: "verified",
        matchedWork: {
          source: "openalex",
          doi: best.doi ?? null,
          title: best.title,
          authors: best.authorships?.map((entry) => entry.author?.display_name),
          score: best.relevance_score,
        },
        reason: "Kecocokan di OpenAlex.",
      };
    }
  } catch {
    return {
      status: "unchecked",
      matchedWork: null,
      reason: "Verifikasi eksternal tidak bisa dihubungi.",
    };
  }

  return {
    status: "needs_review",
    matchedWork: null,
    reason: "Tidak ditemukan di Crossref/OpenAlex; bukan vonis palsu.",
  };
}

export async function verifyCitations(
  rawTexts: string[],
  concurrency = 6,
): Promise<CitationVerification[]> {
  const results: CitationVerification[] = new Array(rawTexts.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < rawTexts.length) {
      const index = cursor++;
      const rawText = rawTexts[index]!;
      try {
        results[index] = await verifyCitation(rawText);
      } catch (error) {
        results[index] = {
          status: "unchecked",
          matchedWork: null,
          reason: error instanceof Error ? error.message : "Gagal memverifikasi.",
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, rawTexts.length) }, () => worker()),
  );
  return results;
}
