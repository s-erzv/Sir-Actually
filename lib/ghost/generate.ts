import { z } from "zod";
import type { LLMProvider } from "@/lib/llm";
import { verifyCitation } from "@/lib/verify/citations";
import { GHOST_SYSTEM, buildGhostPrompt } from "@/lib/prompts/ghost_v1";

const GHOST_SCHEMA = z.object({
  authors: z.string().trim().min(3).max(200),
  year: z.number().int().min(1990).max(2035),
  title: z.string().trim().min(8).max(240),
  journal: z.string().trim().min(3).max(160),
  volume: z.string().trim().max(20).optional(),
  issue: z.string().trim().max(20).optional(),
  pages: z.string().trim().max(40).optional(),
  doi: z.string().trim().max(120).optional(),
});

function formatCitation(input: z.infer<typeof GHOST_SCHEMA>): string {
  const authors = input.authors.replace(/\.$/, "");
  const title = input.title.replace(/\.$/, "");
  const journal = input.journal.replace(/\.$/, "");
  const volume = input.volume ? `, ${input.volume}` : "";
  const issue = input.issue ? `(${input.issue})` : "";
  const pages = input.pages ? `, ${input.pages}` : "";
  const doi = input.doi ? ` https://doi.org/${input.doi}` : "";
  return `${authors} (${input.year}). ${title}. ${journal}${volume}${issue}${pages}.${doi}`;
}

function hash01(seed: number): number {
  let value = seed * 2654435761;
  value = Math.imul(value ^ (value >>> 15), 2246822519);
  return ((value ^ (value >>> 13)) >>> 0) / 0xffffffff;
}

export function fallbackGhostCitation(seed: number): string {
  const authors = [
    "Prameswari, A., & Halim, R.",
    "Nugroho, S., Rafi, M., & Lestari, D.",
    "Santoso, B., & Wijaya, K.",
    "Ayu, N., Prakoso, T., & Firmansyah, R.",
  ];
  const titles = [
    "Phone-bound identity anchors for self-sovereign wallet recovery: a mixed-methods study",
    "Trust transfer from mobile identity to non-custodial wallets in emerging markets",
    "Recoverable key ownership without seed phrases: an SMS-bound delegation model",
    "Everyday verification: phone numbers as a social identity layer for Web3",
  ];
  const journals = [
    "Journal of Emerging Digital Identity",
    "International Review of Blockchain Adoption",
    "Digital Trust and Society",
    "Journal of Fintech and Identity Systems",
  ];
  const index = Math.floor(hash01(seed) * authors.length);
  const year = 2023 + Math.floor(hash01(seed + 1) * 4);
  const volume = 3 + Math.floor(hash01(seed + 2) * 9);
  const issue = 1 + Math.floor(hash01(seed + 3) * 4);
  const suffix = Math.floor(hash01(seed + 4) * 900) + 100;
  return formatCitation({
    authors: authors[index]!,
    year,
    title: titles[(index + 1) % titles.length]!,
    journal: journals[(index + 2) % journals.length]!,
    volume: String(volume),
    issue: String(issue),
    pages: `${80 + (suffix % 40)}-${110 + (suffix % 40)}`,
    doi: `10.5555/jedi.${year}.${volume}.${issue}.${suffix}`,
  });
}

/**
 * Generate one plausible fake reference. The verifier must not find it; if it
 * accidentally matches a real work, fall back to a deterministic fake.
 */
export async function generateGhostCitation(
  provider: LLMProvider,
  realCitations: readonly string[],
  seed: number,
): Promise<string> {
  let candidate: string | null = null;
  if (provider.providerName !== "dummy") {
    try {
      const raw = await provider.completeJson(
        GHOST_SYSTEM,
        buildGhostPrompt(realCitations),
        0.8,
      );
      const parsed = GHOST_SCHEMA.safeParse(raw);
      if (parsed.success) candidate = formatCitation(parsed.data);
    } catch {
      candidate = null;
    }
  }

  const raw = candidate ?? fallbackGhostCitation(seed);
  try {
    const verification = await verifyCitation(raw);
    if (verification.status === "verified") return fallbackGhostCitation(seed + 17);
  } catch {
    // Verification unavailable: deterministic fake is still safe enough.
  }
  return raw;
}
