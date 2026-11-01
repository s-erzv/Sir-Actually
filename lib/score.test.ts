import { describe, expect, it } from "vitest";
import { maxPointsForPlan, pointsForMonster, rankForPoints } from "./score";
import type { FloorPlan } from "@/lib/domain/types";

const floor: FloorPlan = {
  floorOrder: 1,
  dimension: "method",
  bossSlug: "kryvax",
  findingIds: ["a", "b"],
  monsterCount: 2,
  rooms: [
    { kind: "minions", monsterIds: ["a"], optional: false },
    { kind: "boss", monsterIds: ["b"], optional: false },
  ],
};

describe("score", () => {
  it("computes max points from the actual floor plan", () => {
    const max = maxPointsForPlan([floor]);
    expect(max).toBe(20 + 40 + 100 + 30);
  });

  it("maps ratio to rank", () => {
    expect(rankForPoints(900, 1000)).toBe("S");
    expect(rankForPoints(700, 1000)).toBe("A");
    expect(rankForPoints(500, 1000)).toBe("B");
    expect(rankForPoints(100, 1000)).toBe("C");
  });

  it("awards more for bosses", () => {
    expect(pointsForMonster(true)).toBe(40);
    expect(pointsForMonster(false)).toBe(20);
  });
});
