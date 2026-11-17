/**
 * dwellers.ts — monsters that fill out a floor without inventing findings.
 *
 * A dweller quizzes the player on one existing Research Map claim of the
 * floor's dimension. Code decides how many there are, where they stand and
 * how strong they are; the AI only words the question.
 */

import type { Dweller, FloorMap } from "@/lib/domain/types";
import { FLOOR_MONSTER_TARGET_BASE, FLOOR_MONSTER_TARGET_MAX } from "@/lib/balance";
import { monsterLevel } from "@/lib/combat/monsterStats";
import { MINION_ROSTER } from "@/lib/monsters";
import { SPECIALISTS, type ReconDimension } from "@/lib/prompts/findings_v1";

/** Dweller encounters use room numbers from here up, clear of real rooms. */
export const DWELLER_ROOM_BASE = 30;
export const DWELLER_MAX_PER_FLOOR = 6;

const RESEARCH_DIMENSIONS = new Set<string>(["gap", "align", "method", "audit"]);

export function isResearchDimension(dimension: string | undefined): dimension is ReconDimension {
  return dimension !== undefined && RESEARCH_DIMENSIONS.has(dimension);
}

/** Claims a dweller on this floor may ask about, in manuscript order. */
export function eligibleClaims<T extends { kind: string; source_quote?: string | null }>(
  claims: readonly T[],
  dimension: string | undefined,
): T[] {
  if (!isResearchDimension(dimension)) return [];
  const kinds = SPECIALISTS[dimension].claimKinds;
  return claims.filter((claim) => kinds.includes(claim.kind) && (claim.source_quote ?? "").trim().length >= 12);
}

export function floorMonsterTarget(floorOrder: number): number {
  return Math.min(FLOOR_MONSTER_TARGET_BASE + floorOrder, FLOOR_MONSTER_TARGET_MAX);
}

/**
 * How many dwellers a floor gets: enough to reach the floor's target, never
 * more than there are claims to ask about. Zero is a valid answer.
 */
export function dwellerCount(input: {
  floorOrder: number;
  dimension: string | undefined;
  findingCount: number;
  claimCount: number;
}): number {
  if (!isResearchDimension(input.dimension)) return 0;
  const missing = floorMonsterTarget(input.floorOrder) - input.findingCount;
  return Math.max(0, Math.min(missing, input.claimCount, DWELLER_MAX_PER_FLOOR));
}

/** Put `count` dwellers on the map's posts, nearest the start first. */
export function placeDwellers(map: FloorMap, count: number): Dweller[] {
  const spots = map.dwellerSpots ?? [];
  const level = monsterLevel({ kind: "dweller", floorOrder: map.floorOrder });
  return spots.slice(0, Math.max(0, count)).map((tile, index) => ({
    id: `f${map.floorOrder}-d${index}`,
    tile,
    level,
    minionSlug: MINION_ROSTER[(map.floorOrder * 3 + index * 5) % MINION_ROSTER.length]!.slug,
    roomOrder: DWELLER_ROOM_BASE + index,
  }));
}

export function isDwellerRoom(roomOrder: number): boolean {
  return roomOrder >= DWELLER_ROOM_BASE;
}
