import type { Completeness, ManuscriptStage } from "@/lib/supabase/database";
import { DEFAULT_MIN_REFERENCES } from "@/lib/balance";

/**
 * PDF text extraction commonly yields section headings such as
 * "1. Pendahuluan", "2.1 Metode Penelitian", or "DAFTAR PUSTAKA" without
 * Markdown. The prefix is optional so DOCX/Markdown headings still match.
 */
const SECTION_PREFIX = String.raw`^\s*(?:#{1,6}\s*)?(?:\d+(?:\.\d+)*[.)]?\s*)?(?:bab\s+[ivx]+[.:\s-]*)?`;

const SECTION_PATTERNS: Record<string, RegExp> = {
  background: new RegExp(
    `${SECTION_PREFIX}(?:latar\\s+belakang|pendahuluan|introduction|background)\\b`,
    "im",
  ),
  objectives: new RegExp(
    `${SECTION_PREFIX}(?:tujuan(?:\\s+penelitian)?|rumusan\\s+masalah|pertanyaan\\s+penelitian|research\\s+questions?|research\\s+objectives?)\\b`,
    "im",
  ),
  method: new RegExp(
    `${SECTION_PREFIX}(?:metode(?:\\s+penelitian)?|metodologi|methodology|methods?|materials?\\s+and\\s+methods?)\\b`,
    "im",
  ),
  results: new RegExp(
    `${SECTION_PREFIX}(?:hasil(?:\\s+penelitian)?|temuan|results?|findings?)\\b`,
    "im",
  ),
  conclusion: new RegExp(
    `${SECTION_PREFIX}(?:kesimpulan|simpulan|conclusion|conclusions?)\\b`,
    "im",
  ),
};

const REFERENCE_HEADING = new RegExp(
  `${SECTION_PREFIX}(?:daftar\\s+(?:pustaka|rujukan|referensi|bacaan)|bibliografi|references?|bibliography|works\\s+cited)\\s*:?\\s*$`,
  "im",
);

/** Reference headings are often mid-line in two-column PDFs. */
const REFERENCE_ANYWHERE = /daftar\s+(?:pustaka|rujukan|referensi|bacaan)/i;

const ENTRY_START =
  /^\s*(?:\[\d+\]|\d+[.)])\s+|^\s*[A-ZÀ-Ý][\p{L}'’.-]+,\s|^\s*[A-ZÀ-Ý][\p{L}'’.-]+\s+[A-Z]\./u;

const YEAR = /\b(?:19|20)\d{2}[a-z]?\b/;

export interface BibliographyParse {
  sectionFound: boolean;
  entries: string[];
}

export function parseBibliography(sourceText: string): BibliographyParse {
  const normalized = sourceText
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  const lines = normalized.split(/\r?\n/);
  let start = lines.findIndex((line) => REFERENCE_HEADING.test(line.trim()));
  let tail: string[];

  if (start >= 0) {
    tail = lines.slice(start + 1);
  } else {
    // Two-column PDFs merge the heading into a line with the other column.
    const match = REFERENCE_ANYWHERE.exec(normalized);
    if (!match) return { sectionFound: false, entries: [] };
    tail = normalized.slice(match.index + match[0].length).split(/\r?\n/);
  }

  // A line may contain several entries from two columns: split inline [n].
  const expanded: string[] = [];
  for (const line of tail) {
    for (const piece of line.split(/(?=\[\d+\])/)) {
      if (piece.trim()) expanded.push(piece);
    }
  }

  const entries: string[] = [];
  let current: string[] = [];

  const pushCurrent = () => {
    const entry = current.join(" ").replace(/\s+/g, " ").trim();
    if (entry.length >= 12 && YEAR.test(entry)) entries.push(entry);
    current = [];
  };

  for (const line of expanded) {
    const trimmed = line.trim().replace(/^[-*]\s+/, "");
    if (!trimmed) {
      pushCurrent();
      continue;
    }
    if (ENTRY_START.test(trimmed) && current.length > 0) pushCurrent();
    current.push(trimmed);
  }
  pushCurrent();

  return { sectionFound: true, entries };
}

export function requiredSections(stage: ManuscriptStage): string[] {
  if (stage === "proposal") {
    return ["background", "objectives", "method"];
  }
  return ["background", "objectives", "method", "results", "conclusion"];
}

export interface CompletenessInput {
  sourceText: string;
  stage: ManuscriptStage;
  minReferences: number | null;
}

const OBJECTIVE_SENTENCE =
  /\b(?:tujuan\s+penelitian\s+ini\s+adalah|pertanyaan\s+penelitian(?:nya)?\s+adalah|rumusan\s+masalah(?:nya)?\s+adalah)\b/i;

export function checkCompleteness(input: CompletenessInput): Completeness {
  const sections: Record<string, boolean> = {};
  for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
    sections[key] = pattern.test(input.sourceText);
  }
  // Journals often state the objective in a sentence instead of a heading.
  if (!sections.objectives) sections.objectives = OBJECTIVE_SENTENCE.test(input.sourceText);

  const bibliography = parseBibliography(input.sourceText);
  const referenceCount = bibliography.entries.length;
  const missing = requiredSections(input.stage).filter((key) => !sections[key]);
  if (!bibliography.sectionFound || referenceCount === 0) missing.push("references");

  const fallback = DEFAULT_MIN_REFERENCES[input.stage];
  const minReferences = input.minReferences ?? fallback;
  const minReferencesSource = input.minReferences === null ? "default" : "user";
  const warnings: string[] = [];

  if (input.minReferences !== null && referenceCount < input.minReferences) {
    missing.push("references_min");
  } else if (input.minReferences === null && referenceCount < fallback) {
    warnings.push("references_below_default");
  }

  return {
    complete: missing.length === 0,
    missing,
    warnings,
    sections,
    referenceCount,
    minReferences,
    minReferencesSource,
    checkedAt: new Date().toISOString(),
  };
}

export const COMPLETENESS_LABELS: Record<string, string> = {
  background: "Latar belakang / pendahuluan",
  objectives: "Tujuan dan/atau rumusan masalah (RQ)",
  method: "Metode",
  results: "Hasil / temuan",
  conclusion: "Kesimpulan",
  references: "Daftar pustaka (minimal 1 entri terparse)",
  references_min: "Jumlah referensi memenuhi pedoman yang kamu isi",
  references_below_default: "Jumlah referensi di bawah angka default (peringatan saja)",
};
