import { GeneratedQuestionSchema, type GeneratedQuestion } from "./schema";
import { FLOOR_LAYOUT_VERSION } from "@/game/map/buildFloorPlan";

export interface QuestionBankStore {
  layoutVersion: number;
  banks: Record<string, GeneratedQuestion[]>;
}

export function parseQuestionBank(
  value: unknown,
  layoutVersion = FLOOR_LAYOUT_VERSION,
): Record<string, GeneratedQuestion[]> {
  if (!value || typeof value !== "object") return {};
  const store = value as { layoutVersion?: unknown; banks?: unknown };
  if (store.layoutVersion !== layoutVersion) return {};
  if (!store.banks || typeof store.banks !== "object") return {};

  const bank: Record<string, GeneratedQuestion[]> = {};
  for (const [key, entries] of Object.entries(store.banks as Record<string, unknown>)) {
    const parsed = GeneratedQuestionSchema.array().safeParse(entries);
    if (parsed.success && parsed.data.length > 0) bank[key] = parsed.data;
  }
  return bank;
}

export function mergeQuestionBank(
  value: unknown,
  encounterKey: string,
  questions: readonly GeneratedQuestion[],
): QuestionBankStore {
  const banks = parseQuestionBank(value);
  const existing = banks[encounterKey] ?? [];
  const seen = new Set(existing.map((entry) => normalizeQuestion(entry.question)));
  const merged = [...existing];
  for (const question of questions) {
    const key = normalizeQuestion(question.question);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(question);
  }
  if (merged.length > 0) banks[encounterKey] = merged;
  return { layoutVersion: FLOOR_LAYOUT_VERSION, banks };
}

export function normalizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ").toLowerCase();
}

export function findBankQuestion(
  value: unknown,
  encounterKey: string | undefined,
  question: string | undefined,
): GeneratedQuestion | undefined {
  if (!encounterKey || !question) return undefined;
  const banks = parseQuestionBank(value);
  const wanted = normalizeQuestion(question);
  return banks[encounterKey]?.find(
    (entry) => normalizeQuestion(entry.question) === wanted,
  );
}
