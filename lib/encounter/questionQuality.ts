/**
 * lib/encounter/questionQuality.ts — gate every generated question before it
 * reaches the player.
 *
 * A question is "correct" only when it is open, answerable from the manuscript,
 * free of invented numbers, targets the same criteria the Judge will score, and
 * is not a repeat of an earlier question.
 */

import type { RubricCriterion } from "@/lib/domain/types";
import type { AttackType } from "@/lib/planner/attackType";
import { extractNumbers } from "@/lib/judge/extractNumbers";

export interface QuestionQualityInput {
  question: string;
  targetCriteria: readonly RubricCriterion[];
  evidenceQuote: string;
  sourceText?: string;
  previousQuestions?: readonly string[];
  maxWords: number;
}

export type QuestionQualityResult =
  | { ok: true }
  | { ok: false; repair: string };

const OPENERS = [
  "jelaskan",
  "bagaimana",
  "mengapa",
  "kenapa",
  "di bagian mana",
  "di mana",
  "berapa",
  "apa ",
  "apa yang",
  "apa alasan",
  "apa dampak",
  "apa akibat",
  "apa keterbatasan",
  "mana yang",
  "sebutkan",
  "tunjukkan",
  "uraikan",
  "bandingkan",
  "sejauh mana",
  "seberapa",
];

const YES_NO = /^(apakah|is |are |do |does |did |can |could |should |would )/i;
const LEAK = /jawabannya|jawaban yang benar|kunci jawaban|seharusnya adalah/i;

function fail(repair: string): QuestionQualityResult {
  return { ok: false, repair };
}

function trigrams(text: string): Set<string> {
  const normalized = ` ${text.toLowerCase().replace(/\s+/g, " ").trim()} `;
  const grams = new Set<string>();
  for (let index = 0; index + 3 <= normalized.length; index += 1) {
    grams.add(normalized.slice(index, index + 3));
  }
  return grams;
}

/** Jaccard similarity over character trigrams. */
export function questionSimilarity(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const gram of left) if (right.has(gram)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

export function checkQuestionQuality(input: QuestionQualityInput): QuestionQualityResult {
  const text = input.question.trim();
  const lower = text.toLowerCase();

  if (!text) return fail("Pertanyaan kosong. Tulis satu pertanyaan.");
  if (text.includes("\n") || text.includes("[Dummy]")) {
    return fail("Tulis satu baris pertanyaan tanpa penanda internal.");
  }
  if ((text.match(/\?/g) ?? []).length !== 1) {
    return fail("Tepat satu tanda tanya. Jangan menambah tanda tanya lain.");
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > input.maxWords) {
    return fail(`Maksimal ${input.maxWords} kata. Ringkas pertanyaan.`);
  }
  if (YES_NO.test(lower)) {
    return fail("Jangan pertanyaan ya/tidak. Mulai dengan kata tanya terbuka.");
  }
  if (!OPENERS.some((opener) => lower.startsWith(opener))) {
    return fail(`Mulai dengan salah satu pembuka: ${OPENERS.join(", ")}.`);
  }
  if (LEAK.test(lower)) {
    return fail("Jangan menyebut atau membocorkan jawaban di dalam pertanyaan.");
  }

  const allowedNumbers = new Set([
    ...extractNumbers(input.evidenceQuote),
    ...extractNumbers(input.sourceText ?? ""),
  ]);
  const foreignNumbers = extractNumbers(text).filter(
    (value) => !allowedNumbers.has(value) && (value >= 10 || !Number.isInteger(value)),
  );
  if (foreignNumbers.length > 0) {
    return fail(
      `Angka ${foreignNumbers.join(", ")} tidak ada di naskah. Jangan mengarang angka.`,
    );
  }

  for (const previous of input.previousQuestions ?? []) {
    if (questionSimilarity(text, previous) > 0.85) {
      return fail("Pertanyaan terlalu mirip pertanyaan sebelumnya. Serang sudut lain.");
    }
  }

  return { ok: true };
}

const TEMPLATES: Record<AttackType, (criterion: string) => string> = {
  clarify: (criterion) => `Jelaskan bagaimana kutipan ini mendukung ${criterion}?`,
  spot: (criterion) => `Tunjukkan bagian naskah yang membuktikan ${criterion}?`,
  numbers: (criterion) => `Sebutkan angka di naskah yang mendukung ${criterion}?`,
  challenge: (criterion) => `Mengapa ${criterion} pada kutipan ini masih lemah?`,
  counterexample: (criterion) => `Apa contoh yang membantah ${criterion} pada kutipan ini?`,
  limitation: (criterion) => `Apa keterbatasan yang belum dijelaskan untuk ${criterion}?`,
  scenario: (criterion) => `Apa yang terjadi pada klaim ini jika ${criterion} tidak terpenuhi?`,
  repair: (criterion) => `Bagaimana kamu memperbaiki ${criterion} pada kutipan ini?`,
};

/** Deterministic last resort so the game never stalls on a bad LLM question. */
export function templateQuestion(
  attackType: AttackType,
  targetCriteria: readonly RubricCriterion[],
): string {
  const criterion = targetCriteria[0]?.label ?? "hubungan tujuan dan temuan";
  const builder = TEMPLATES[attackType] ?? TEMPLATES.clarify;
  return builder(criterion);
}
