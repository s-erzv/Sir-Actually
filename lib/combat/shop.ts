/**
 * Coins, shop and potion bag. All of it is derived from run_points_events,
 * so every purchase and every sip is an idempotent row, never a counter.
 */

import { POTION_BAG_MAX, SHOP_ITEMS } from "@/lib/balance";

export type ShopItemSlug = keyof typeof SHOP_ITEMS;
export const SHOP_ITEM_SLUGS = Object.keys(SHOP_ITEMS) as ShopItemSlug[];

export interface PointsEvent {
  kind: string;
  amount: number;
}

export interface Wallet {
  /** Spendable now: everything earned minus everything spent. */
  coins: number;
  /** Everything earned; this is what the rank is based on. */
  gross: number;
  /** HP each potion in the bag restores, oldest first. */
  potions: number[];
}

const GAIN = "potion_gain";
const USE = "potion_use";

/** `potion_gain` rows carry the heal in the key (`...:heal40`), amount stays 0. */
export function potionHealFromKey(key: string): number {
  const match = /:heal(\d+)$/.exec(key);
  return match ? Number(match[1]) : SHOP_ITEMS.potion_small.heal;
}

export function walletFromEvents(
  events: ReadonlyArray<PointsEvent & { encounter_key?: string | null }>,
): Wallet {
  let coins = 0;
  let gross = 0;
  const gained: number[] = [];
  let used = 0;
  for (const event of events) {
    coins += event.amount;
    if (event.amount > 0) gross += event.amount;
    if (event.kind === GAIN) gained.push(potionHealFromKey(event.encounter_key ?? ""));
    if (event.kind === USE) used += 1;
  }
  return { coins, gross, potions: gained.slice(Math.min(used, gained.length)) };
}

export type PurchaseCheck = { ok: true } | { ok: false; reason: string };

export function canBuy(wallet: Wallet, item: ShopItemSlug): PurchaseCheck {
  const entry = SHOP_ITEMS[item];
  if (wallet.potions.length >= POTION_BAG_MAX) {
    return { ok: false, reason: `Tas ramuan penuh (maks ${POTION_BAG_MAX}). Minum satu dulu.` };
  }
  if (wallet.coins < entry.price) {
    return { ok: false, reason: `Poin kurang: butuh ${entry.price}, kamu punya ${wallet.coins}.` };
  }
  return { ok: true };
}

/** HP after drinking; never above the maximum. */
export function healedHp(hp: number, hpMax: number, heal: number): number {
  return Math.min(hpMax, Math.max(0, hp) + heal);
}
