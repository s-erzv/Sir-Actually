import { LOOT_POTION_ONE_IN, NOOK_POTION_ONE_IN } from "@/lib/balance";

/**
 * Loot value is derived from its stable key, so the client cannot choose the
 * reward and replaying a floor cannot farm the same pickup.
 */
export function lootAmountForKey(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return 1 + ((hash >>> 0) % 5);
}

/**
 * Some loot spots hold a potion instead of points. Derived from the key, so
 * the same spot always holds the same thing and the client cannot choose.
 */
export function lootKindForKey(key: string): "points" | "potion" {
  let hash = 5381;
  for (let index = 0; index < key.length; index += 1) {
    hash = (Math.imul(hash, 33) ^ key.charCodeAt(index)) >>> 0;
  }
  const oneIn = key.includes("-nook:") ? NOOK_POTION_ONE_IN : LOOT_POTION_ONE_IN;
  return hash % oneIn === 0 ? "potion" : "points";
}
