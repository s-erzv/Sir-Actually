/**
 * Coins, potion bag and equipment. All of it is derived from run_points_events,
 * so every purchase, sip, equip and absorbed hit is an idempotent row, never a
 * counter. Callers pass events oldest first.
 */

import { POTION_BAG_MAX } from "@/lib/balance";
import { ITEMS, ITEM_SLUGS, getItem, stockForFloor, type ItemSlug } from "./items";

export type ShopItemSlug = ItemSlug;
export const SHOP_ITEM_SLUGS = ITEM_SLUGS;

export interface PointsEvent {
  kind: string;
  amount: number;
}

export interface EquippedWeapon {
  slug: string;
  name: string;
  power: number;
}

export interface EquippedArmor {
  slug: string;
  name: string;
  shield: number;
  shieldMax: number;
}

export interface Wallet {
  /** Spendable now: everything earned minus everything spent. */
  coins: number;
  /** Everything earned; this is what the rank is based on. */
  gross: number;
  /** HP each potion in the bag restores, oldest first. */
  potions: number[];
  weapon: EquippedWeapon | null;
  armor: EquippedArmor | null;
}

const GAIN = "potion_gain";
const USE = "potion_use";
export const EQUIP = "equip";
export const ABSORB = "armor_absorb";

/** `potion_gain` rows carry the heal in the key (`...:heal40`), amount stays 0. */
export function potionHealFromKey(key: string): number {
  const match = /:heal(\d+)$/.exec(key);
  return match ? Number(match[1]) : ITEMS.potion_small.heal;
}

/** `equip` rows end with the item slug (`equip:<purchase>:weapon_sword`). */
export function itemFromEquipKey(key: string): string | null {
  const match = /:([a-z_]+)$/.exec(key);
  return match ? match[1]! : null;
}

/** `armor_absorb` rows end with the shield points spent (`...:abs12`). */
export function absorbedFromKey(key: string): number {
  const match = /:abs(\d+)$/.exec(key);
  return match ? Number(match[1]) : 0;
}

export function walletFromEvents(
  events: ReadonlyArray<PointsEvent & { encounter_key?: string | null }>,
): Wallet {
  let coins = 0;
  let gross = 0;
  const gained: number[] = [];
  let used = 0;
  let weapon: EquippedWeapon | null = null;
  let armor: EquippedArmor | null = null;
  for (const event of events) {
    const key = event.encounter_key ?? "";
    coins += event.amount;
    if (event.amount > 0) gross += event.amount;
    if (event.kind === GAIN) gained.push(potionHealFromKey(key));
    if (event.kind === USE) used += 1;
    if (event.kind === EQUIP) {
      const item = getItem(itemFromEquipKey(key) ?? "");
      if (item?.kind === "weapon") weapon = { slug: item.slug, name: item.name, power: item.power ?? 0 };
      if (item?.kind === "armor") {
        armor = { slug: item.slug, name: item.name, shield: item.shield ?? 0, shieldMax: item.shield ?? 0 };
      }
    }
    if (event.kind === ABSORB && armor) {
      const shield: number = armor.shield - absorbedFromKey(key);
      armor = shield > 0 ? { ...armor, shield } : null;
    }
  }
  return { coins, gross, potions: gained.slice(Math.min(used, gained.length)), weapon, armor };
}

export type PurchaseCheck = { ok: true } | { ok: false; reason: string };

export function canBuy(wallet: Wallet, slug: string, floor: number): PurchaseCheck {
  const item = getItem(slug);
  if (!item || !stockForFloor(floor).some((entry) => entry.slug === item.slug)) {
    return { ok: false, reason: "Barang ini tidak dijual di lantai ini." };
  }
  if (item.kind === "potion" && wallet.potions.length >= POTION_BAG_MAX) {
    return { ok: false, reason: `Tas ramuan penuh (maks ${POTION_BAG_MAX}). Minum satu dulu.` };
  }
  if (item.kind === "weapon" && wallet.weapon?.slug === item.slug) {
    return { ok: false, reason: `${item.name} sudah terpasang.` };
  }
  // The same armor may be bought again only to replace a dented one.
  if (item.kind === "armor" && wallet.armor?.slug === item.slug && wallet.armor.shield >= wallet.armor.shieldMax) {
    return { ok: false, reason: `${item.name} sudah terpasang.` };
  }
  if (wallet.coins < item.price) {
    return { ok: false, reason: `Koin kurang: butuh ${item.price}, kamu punya ${wallet.coins}.` };
  }
  return { ok: true };
}

/** HP after drinking; never above the maximum. */
export function healedHp(hp: number, hpMax: number, heal: number): number {
  return Math.min(hpMax, Math.max(0, hp) + heal);
}

/** A counter-attack hits the armor's shield first, then HP. */
export function absorbHit(counter: number, shield: number): { absorbed: number; hpLoss: number; broken: boolean } {
  const absorbed = Math.min(Math.max(0, counter), Math.max(0, shield));
  return { absorbed, hpLoss: Math.max(0, counter) - absorbed, broken: shield > 0 && absorbed >= shield };
}
