/**
 * lib/balance.ts — all game balance constants.
 *
 * These are starting-point values agreed by Maou (BRIEF.md §7).
 * They have NOT been calibrated from playtesting data.
 * Change them here; every other file imports from this module.
 */

export const HEARTS_START = 3;
export const HEART_MAX = 5;
export const BOSS_HP = 100;
export const MINION_HP = 100;

/**
 * Maximum fraction of hpMax that a single answer can deal.
 * boss: 0.45 → max 45 damage per answer → need at least 3 good answers
 * minion: 0.60 → max 60 damage per answer → need at least 2 good answers
 */
export const HIT_CAP = { boss: 0.45, minion: 0.6 } as const;
export const HIT_CAP_CEILING = { boss: 0.49, minion: 0.66 } as const;

/**
 * Legacy threshold, used only when the Judge does not return `addressed`.
 * With the encounter schema, a Heart is lost only when the answer does not
 * address the question that was asked.
 */
export const HEART_LOSS_MAX_SCORE = 1;

export const WEAPON_DAMAGE_BONUS_MIN = 0.95;
export const WEAPON_DAMAGE_BONUS_MAX = 1.10;

export const MAX_QUESTIONS_PER_ROOM = 4;
export const MAX_QUESTIONS_BOSS = 6;
export const MAX_QUESTIONS_MINION = 3;
export const MAX_ROOMS_PER_RUN = 18;
export const MAX_FLOORS = 6;

/**
 * Objection! is a free pass with no evidence check yet. Cap it so a player
 * cannot dispute every monster and walk down the dungeon without answering.
 * Future work: verify the dispute against the manuscript before accepting it.
 */
export const MAX_OBJECTIONS_PER_FLOOR = 1;

/** Confidence below this value makes the room optional, not an accusation. */
export const LOW_CONFIDENCE = 0.5;

// ---------------------------------------------------------------------------
// Derived helpers (pure, depend only on constants above)
// ---------------------------------------------------------------------------

/**
 * Compute damage for one answer.
 * damage = floor(scoreTotal / scoreMax × HIT_CAP[kind] × hpMax)
 */
export function computeDamageFromBalance(
  scoreTotal: number,
  scoreMax: number,
  isBoss: boolean,
  hpMax: number,
): number {
  if (scoreMax <= 0) return 0;
  const cap = isBoss ? HIT_CAP.boss : HIT_CAP.minion;
  return Math.floor((scoreTotal / scoreMax) * cap * hpMax);
}

export const POINTS_MINION_WON = 20;
export const POINTS_BOSS_WON = 40;
export const POINTS_FLOOR_CLEARED = 100;
export const POINTS_FLAWLESS = 50;
export const POINTS_NO_HEART_LOST = 30;
export const POINTS_STREAK_STEP = 10;
export const POINTS_STREAK_MAX = 20;
export const RANK_RATIO = { S: 0.85, A: 0.7, B: 0.5 } as const;

// ---------------------------------------------------------------------------
// Dungeon RPG v2 (docs/superpowers/specs/2026-11-17-dungeon-rpg-v2-design.md)
// Starting points, not calibrated from playtests.
// ---------------------------------------------------------------------------

/** One Heart is a container of this much HP. */
export const HEART_HP = 100;

/** Answer length gate (BRIEF §13.4). Short answers deal no damage, no counter. */
export const MIN_ANSWER_LENGTH = 12;
export const MAX_ANSWER_LENGTH = 1200;

/** Damage multiplier per answer quality 0-5. Deliberately stingy. */
export const QUALITY_MULTIPLIER = [0, 0.15, 0.35, 0.55, 0.8, 1] as const;
export const QUALITY_LABELS = ["Meleset", "Goresan", "Lemah", "Kena", "Telak", "Kritis"] as const;

export const WEAPON_POWER = { basic: 30, signature: 44 } as const;
/** Flat damage a character passive may add to a hit that already landed. */
export const PASSIVE_DAMAGE_MAX = 3;

export const MONSTER_LEVEL_MAX = 6;
export const MONSTER_STATS = {
  minion: { hp: 45, hpPerLevel: 8, attack: 30, attackPerLevel: 8, attackMax: 80 },
  boss: { hp: 110, hpPerLevel: 15, attack: 60, attackPerLevel: 10, attackMax: 100 },
  dweller: { hp: 22, hpPerLevel: 4, attack: 20, attackPerLevel: 5, attackMax: 50 },
} as const;

/** Share of a monster's attack that lands, by answer quality. */
export const COUNTER_BY_QUALITY = [1, 0.4, 0, 0, 0, 0] as const;

/** A research floor is filled with dwellers up to this many monsters. */
export const FLOOR_MONSTER_TARGET_BASE = 3;
export const FLOOR_MONSTER_TARGET_MAX = 7;
export const POINTS_DWELLER_WON = 10;

export const POTION_BAG_MAX = 3;
export const SHOP_ITEMS = {
  potion_small: { name: "Ramuan Kecil", heal: 40, price: 25 },
  potion_large: { name: "Ramuan Besar", heal: 100, price: 55 },
  potion_heart: { name: "Ramuan Hati", heal: HEART_HP, price: 90 },
} as const;
/** One in N loot spots holds a potion instead of points. */
export const LOOT_POTION_ONE_IN = 5;
export const NOOK_POTION_ONE_IN = 3;
