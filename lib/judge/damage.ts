/**
 * damage.ts — step 4 of the Judge pipeline.
 *
 * Pure functions for computing damage and Heart loss.
 * Formula from BRIEF.md §7:
 *   damage = floor(scoreTotal / scoreMax × HIT_CAP[kind] × hpMax)
 *
 * Invariants:
 * - damage is always non-negative
 * - damage is always ≤ floor(HIT_CAP[kind] × hpMax) — one answer cannot one-shot
 * - heartLost iff scoreTotal ≤ HEART_LOSS_MAX_SCORE (1)
 */

import { HIT_CAP, HIT_CAP_CEILING, HEART_LOSS_MAX_SCORE, BOSS_HP, MINION_HP } from "@/lib/balance";

/**
 * Compute damage dealt by one answer.
 *
 * @param scoreTotal  Sum of criterion levels after validation + caps (0–scoreMax)
 * @param scoreMax    Maximum possible score (number of criteria × 2)
 * @param isBoss      True for boss encounters, false for minion encounters
 * @param hpMax       Maximum HP of the target (usually BOSS_HP or MINION_HP)
 */
export function computeDamage(
  scoreTotal: number,
  scoreMax: number,
  isBoss: boolean,
  hpMax: number,
  weaponBonus = 1,
): number {
  if (scoreMax <= 0 || hpMax <= 0) return 0;
  const baseCap = isBoss ? HIT_CAP.boss : HIT_CAP.minion;
  const maxCap = isBoss ? HIT_CAP_CEILING.boss : HIT_CAP_CEILING.minion;
  const cap = Math.min(baseCap * weaponBonus, maxCap);
  const raw = (scoreTotal / scoreMax) * cap * hpMax;
  return Math.max(0, Math.floor(raw));
}

/**
 * Returns true if the player should lose a Heart.
 * BRIEF §7: scoreTotal ≤ HEART_LOSS_MAX_SCORE (currently 1).
 */
export function computeHeartLoss(scoreTotal: number): boolean {
  return scoreTotal <= HEART_LOSS_MAX_SCORE;
}

// ---------------------------------------------------------------------------
// Convenient wrapper used by the route handler
// ---------------------------------------------------------------------------

export interface DamageResult {
  damage: number;
  heartLost: boolean;
}

export function evaluateDamage(
  scoreTotal: number,
  scoreMax: number,
  isBoss: boolean,
): DamageResult {
  const hpMax = isBoss ? BOSS_HP : MINION_HP;
  return {
    damage: computeDamage(scoreTotal, scoreMax, isBoss, hpMax),
    heartLost: computeHeartLoss(scoreTotal),
  };
}
