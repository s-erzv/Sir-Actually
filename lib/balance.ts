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

/** Score (sum of criterion levels) at or below which a Heart is lost. */
export const HEART_LOSS_MAX_SCORE = 1;

export const WEAPON_DAMAGE_BONUS_MIN = 0.95;
export const WEAPON_DAMAGE_BONUS_MAX = 1.10;

export const MAX_QUESTIONS_PER_ROOM = 4;
export const MAX_QUESTIONS_BOSS = 4;
export const MAX_QUESTIONS_MINION = 2;
export const MAX_ROOMS_PER_RUN = 18;
export const MAX_FLOORS = 6;

/** Confidence below this value makes the room optional, not an accusation. */
export const LOW_CONFIDENCE = 0.5;

/**
 * Default minimum reference counts per manuscript stage.
 * NOTE: These are UNCALIBRATED defaults — not authoritative standards.
 * They only trigger a warning in the Weakness Report, not a hard gate,
 * unless the player fills in their own institutional minimum.
 */
export const DEFAULT_MIN_REFERENCES = {
  proposal: 10,
  skripsi: 20,
  jurnal: 15,
} as const;

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
