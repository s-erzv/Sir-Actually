/**
 * lib/dungeon/runProgress.ts — guards resumed runs against layout changes.
 *
 * `progress.resolved` stores positional encounter keys. When the floor layout
 * changes (room composition, ordering), those keys can silently point at a
 * different finding. A version marker lets us close stale runs once instead.
 */

import { FLOOR_LAYOUT_VERSION } from "@/game/map/buildFloorPlan";

export function storedLayoutVersion(progress: unknown): number {
  if (!progress || typeof progress !== "object") return 0;
  const value = (progress as { layoutVersion?: unknown }).layoutVersion;
  return typeof value === "number" ? value : 0;
}

export function isStaleRunProgress(progress: unknown): boolean {
  return storedLayoutVersion(progress) !== FLOOR_LAYOUT_VERSION;
}

export function currentProgress(resolvedKeys: readonly string[]): {
  layoutVersion: number;
  resolved: string[];
} {
  return {
    layoutVersion: FLOOR_LAYOUT_VERSION,
    resolved: [...new Set(resolvedKeys)].sort(),
  };
}
