import { describe, expect, it } from "vitest";
import { buildFloorPlan } from "@/game/map/buildFloorPlan";
import { generateFloorFromPlan } from "@/game/map/generateFloor";
import { TileCode } from "@/game/map/tiles";
import { lootSpotsForFloor } from "./lootSpots";
import type { FindingStub } from "@/lib/domain/types";

function finding(rank: number): FindingStub {
  return {
    id: `loot-finding-${rank}`,
    weaknessType: "sample_unreported",
    severity: 2,
    centrality: 2,
    confidence: 0.8,
    evidenceQuote: `quote ${rank}`,
    floor: 1,
    rank,
  };
}

describe("lootSpotsForFloor", () => {
  it("places deterministic loot on walkable tiles, including maze dead ends", () => {
    const plan = buildFloorPlan([1, 2, 3, 4].map(finding), true).find(
      (floor) => floor.dimension === "method",
    )!;
    const map = generateFloorFromPlan(plan, 42);
    const spots = lootSpotsForFloor(map);

    expect(spots.length).toBeGreaterThan(0);
    expect(new Set(spots.map((spot) => spot.key)).size).toBe(spots.length);
    expect(spots).toEqual(lootSpotsForFloor(map));
    for (const spot of spots) {
      expect([TileCode.FLOOR, TileCode.FLOOR_ALT]).toContain(map.tiles[spot.y]?.[spot.x]);
    }
    expect(spots.filter((spot) => spot.key.startsWith("nook:")).length).toBe(map.deadEnds!.length);
  });
});
