/** Current floor is derived from server-written floor_cleared events. */
export function currentFloorFromCleared(
  clearedFloors: readonly number[],
  floorCount?: number | null,
): number {
  const highest = clearedFloors.length > 0 ? Math.max(...clearedFloors) : 0;
  const next = highest + 1;
  return floorCount && floorCount > 0 ? Math.min(next, floorCount) : next;
}
