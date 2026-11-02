import type { AttackType } from "./attackType";

export type MonsterLevel = 1 | 2 | 3;

export const MONSTER_LEVEL_LABELS: Record<MonsterLevel, string> = {
  1: "Mudah",
  2: "Sedang",
  3: "Sulit",
};

export function monsterLevelFor(input: {
  floorOrder: number;
  roomOrder: number;
  isBoss: boolean;
  bossSlug?: string | null;
}): MonsterLevel {
  if (input.bossSlug === "nyxara") return 2;
  if (input.isBoss) return 3;
  if (input.floorOrder <= 2) return input.roomOrder <= 1 ? 1 : 2;
  return 2;
}

const EASY: ReadonlySet<AttackType> = new Set(["clarify", "spot", "numbers"]);
const MEDIUM: ReadonlySet<AttackType> = new Set([
  "clarify",
  "spot",
  "numbers",
  "challenge",
  "limitation",
  "repair",
]);

export function attackTypesForLevel(
  allowed: readonly AttackType[],
  level: MonsterLevel,
): AttackType[] {
  const pool = level === 1 ? EASY : level === 2 ? MEDIUM : null;
  if (!pool) return [...allowed];
  const filtered = allowed.filter((attack) => pool.has(attack));
  return filtered.length > 0 ? filtered : [...allowed];
}

export function maxQuestionWordsForLevel(level: MonsterLevel): number {
  return level === 1 ? 20 : level === 2 ? 24 : 28;
}

export function levelInstruction(level: MonsterLevel): string {
  if (level === 1) {
    return `TINGKAT MUDAH:
- Pertanyaan harus bisa dijawab langsung dari kutipan yang diserang.
- Minta satu hal saja: tunjukkan kalimat, sebutkan angka, atau jelaskan istilah.
- Maksimal 20 kata. Jangan minta analisis multi-langkah.`;
  }
  if (level === 2) {
    return `TINGKAT SEDANG:
- Minta satu alasan singkat plus bukti dari naskah.
- Boleh menanyakan hubungan sederhana antara klaim dan bukti.
- Maksimal 24 kata.`;
  }
  return `TINGKAT SULIT:
- Boleh meminta hubungan antar bagian, keterbatasan, atau skenario.
- Tetap satu sasaran utama dan satu tanda tanya.
- Maksimal 28 kata.`;
}
