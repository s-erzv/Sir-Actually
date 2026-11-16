/** Player HP helpers. `runs.hearts_left` stores total HP, not a Heart count. */

import { HEART_HP } from "@/lib/balance";
import { heartsForLoadout } from "@/lib/loadout";

export function playerHpMax(characterSlug: string | null | undefined): number {
  return heartsForLoadout(characterSlug ?? "arka") * HEART_HP;
}

/** Hearts shown on screen: a Heart counts while it holds any HP. */
export function heartsFromHp(hp: number): number {
  return Math.max(0, Math.ceil(hp / HEART_HP));
}

export function playerVitals(storedHp: number, characterSlug: string | null | undefined) {
  const hpMax = playerHpMax(characterSlug);
  const hp = Math.max(0, Math.min(hpMax, storedHp));
  return { hp, hpMax, hearts: heartsFromHp(hp), heartsMax: hpMax / HEART_HP };
}
