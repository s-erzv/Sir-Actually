import {
  POINTS_BOSS_WON,
  POINTS_FLOOR_CLEARED,
  POINTS_MINION_WON,
  POINTS_NO_HEART_LOST,
  RANK_RATIO,
} from "@/lib/balance";
import type { FloorPlan } from "@/lib/domain/types";

export type RunRank = "S" | "A" | "B" | "C";

export function maxPointsForPlan(floors: readonly FloorPlan[]): number {
  return floors.reduce((total, floor) => {
    const roomPoints = floor.rooms.reduce((sum, room) => {
      if (room.kind === "boss" || room.kind === "special") return sum + POINTS_BOSS_WON;
      return sum + room.monsterIds.length * POINTS_MINION_WON;
    }, 0);
    return (
      total +
      roomPoints +
      POINTS_FLOOR_CLEARED +
      POINTS_NO_HEART_LOST
    );
  }, 0);
}

export function rankForPoints(points: number, maxPoints: number): RunRank {
  if (maxPoints <= 0) return "C";
  const ratio = points / maxPoints;
  if (ratio >= RANK_RATIO.S) return "S";
  if (ratio >= RANK_RATIO.A) return "A";
  if (ratio >= RANK_RATIO.B) return "B";
  return "C";
}

export function pointsForMonster(isBoss: boolean): number {
  return isBoss ? POINTS_BOSS_WON : POINTS_MINION_WON;
}
