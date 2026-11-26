/** Monster level, stats and gear. Pure; every number comes from balance.ts. */

import type { MonsterKind } from "@/lib/domain/types";
import { MONSTER_LEVEL_MAX, MONSTER_STATS } from "@/lib/balance";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

/** Deeper floors and heavier findings make stronger monsters. */
export function monsterLevel(input: {
  kind: MonsterKind;
  floorOrder: number;
  /** Finding severity 1-3; ignored for bosses and dwellers. */
  severity?: number;
}): number {
  if (input.kind === "boss") return clamp(input.floorOrder + 1, 2, MONSTER_LEVEL_MAX);
  if (input.kind === "dweller") return clamp(input.floorOrder, 1, MONSTER_LEVEL_MAX);
  return clamp(input.floorOrder + (input.severity ?? 2) - 2, 1, MONSTER_LEVEL_MAX);
}

export interface MonsterStats {
  hp: number;
  attack: number;
  maxQuestions: number;
}

export function monsterStats(kind: MonsterKind, level: number): MonsterStats {
  const lvl = clamp(level, 1, MONSTER_LEVEL_MAX);
  const base = MONSTER_STATS[kind];
  const maxQuestions =
    kind === "dweller" ? 1 : kind === "boss" ? (lvl >= 4 ? 7 : 6) : lvl >= 3 ? 4 : 3;
  return {
    hp: base.hp + base.hpPerLevel * (lvl - 1),
    attack: Math.min(base.attackMax, base.attack + base.attackPerLevel * (lvl - 1)),
    maxQuestions,
  };
}

const GEAR = [
  { slug: "club", name: "Pentung" },
  { slug: "dagger", name: "Belati" },
  { slug: "sword", name: "Pedang" },
  { slug: "axe", name: "Kapak" },
  { slug: "armor", name: "Zirah" },
  { slug: "crown", name: "Mahkota" },
] as const;

/** The same monster carries better gear on deeper floors. */
export function gearForLevel(level: number): { slug: string; name: string } {
  return GEAR[clamp(level, 1, MONSTER_LEVEL_MAX) - 1]!;
}
