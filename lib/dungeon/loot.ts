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
