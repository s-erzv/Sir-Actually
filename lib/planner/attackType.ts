/**
 * attackType.ts — Pure function that picks the next attack type for a boss.
 *
 * Rules:
 * 1. Never repeat an attack type that has already been used in this room.
 * 2. If all allowed types are exhausted, pick any except `lastUsed`.
 * 3. Order of preference: unused first, then least-recently-used.
 * 4. Uses a seeded index to be deterministic when possible; caller can pass
 *    a counter as `pickIndex` (defaults to 0).
 */

export type AttackType =
  | "clarify"
  | "challenge"
  | "counterexample"
  | "numbers"
  | "limitation"
  | "spot"
  | "scenario"
  | "repair";

/**
 * Pick the next attack type for a room.
 *
 * @param allowed   Attack types permitted for this weakness type.
 * @param used      Attack types already used in this room (may repeat across rooms).
 * @param lastUsed  The most recently used attack type (not repeated if possible).
 * @param pickIndex Deterministic offset for choosing among equally valid options.
 */
export function pickAttackType(
  allowed: readonly AttackType[],
  used: readonly AttackType[],
  lastUsed?: AttackType,
  pickIndex = 0,
): AttackType {
  if (allowed.length === 0) {
    throw new Error("pickAttackType: allowed list must not be empty");
  }

  const usedSet = new Set(used);

  // Prefer types not yet used
  const unused = allowed.filter((t) => !usedSet.has(t));
  if (unused.length > 0) {
    // Among unused, avoid lastUsed if we have options
    const candidates = unused.length > 1 && lastUsed
      ? unused.filter((t) => t !== lastUsed)
      : unused;
    return candidates[pickIndex % candidates.length]!;
  }

  // All types have been used — avoid lastUsed if possible
  const candidates = allowed.length > 1 && lastUsed
    ? allowed.filter((t) => t !== lastUsed)
    : allowed;
  return candidates[pickIndex % candidates.length]!;
}
