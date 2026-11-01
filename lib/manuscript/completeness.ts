import type { Completeness, ManuscriptStage } from "@/lib/supabase/database";
import { DEFAULT_MIN_REFERENCES } from "@/lib/balance";

const SECTION_PATTERNS: Record<string, RegExp> = {
  background: /^\s*(?:bab\s+[ivx]+[.:\s-]*)?(?:latar\s+belakang|pendahuluan|introduction|background)\b/im,
  objectives:
    /^\s*(?:bab\s+[ivx]+[.:\s-]*)?(?:tujuan(?:\s+penelitian)?|rumusan\s+masalah|pertanyaan\s+penelitian|research\s+questions?|research\s+objectives?)\b/im,
  method:
    /^\s*(?:bab\s+[ivx]+[.:\s-]*)?(?:metode(?:\s+penelitian)?|metodologi|methodology|methods?|materials?\s+and\s+methods?)\b/im,
  results:
    /^\s*(?:bab\s+[ivx]+[.:\s-]*)?(?:hasil(?:\s+penelitian)?|temuan|results?|findings?)\b/im,
  conclusion:
    /^\s*(?:bab\s+[ivx]+[.:\s-]*)?(?:kesimpulan|simpulan|conclusion|conclusions?)\b/im,
};

const REFERENCE_HEADING =
  /^\s*(?:bab\s+[ivx]+[.:\s-]*)?(?:daftar\s+pustaka|daftar\s+referensi|referensi|bibliografi|references?|bibliography|works\s+cited)\s*:?\s*$/im;

const ENTRY_START =
  /^\s*(?:\[\d+\]|\d+[.)])\s+|^\s*[A-ZÀ-Ý][\p{L}'’.-]+,\s|^\s*[A-ZÀ-Ý][\p{L}'’.-]+\s+[A-Z]\./u;

const YEAR = /\b(?:19|20)\d{2}[a-z]?\b/;

export interface BibliographyParse {
  sectionFound: boolean;
  entries: string[];
}

export function parseBibliography(sourceText: string): BibliographyParse {
  const lines = sourceText.split(/\r?\n/);
  const start = lines.findIndex((line) => REFERENCE_HEADING.test(line.trim()));
  if (start < 0) return { sectionFound: false, entries: [] };

  const tail = lines.slice(start + 1);
  const entries: string[] = [];
  let current: string[] = [];

  const pushCurrent = () => {
    const entry = current.join(" ").replace(/\s+/g, " ").trim();
    if (entry.length >= 12 && YEAR.test(entry)) entries.push(entry);
    current = [];
  };

  for (const line of tail) {
    const trimmed = line.trim();
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

export function checkCompleteness(input: CompletenessInput): Completeness {
  const sections: Record<string, boolean> = {};
  for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
    sections[key] = pattern.test(input.sourceText);
  }

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
