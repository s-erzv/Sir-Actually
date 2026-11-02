import { describe, expect, it } from "vitest";
import { buildFloorPlan } from "./buildFloorPlan";
import { generateFloorFromPlan } from "./generateFloor";
import { TileCode, isSolid } from "./tiles";
import type { FindingStub, WeaknessType } from "@/lib/domain/types";

let nextId = 0;

function finding(weaknessType: WeaknessType, rank: number): FindingStub {
  nextId += 1;
  return {
    id: `plan-finding-${nextId}`,
    weaknessType,
    severity: 2,
    centrality: 2,
    confidence: 0.8,
    evidenceQuote: `quote ${nextId}`,
    floor: 1,
    rank,
  };
}

describe("generateFloorFromPlan", () => {
  it("renders one map room per planned room and one spawn per monster", () => {
    const findings = Array.from({ length: 7 }, (_, index) =>
      finding("sample_unreported", index + 1),
    );
    const plan = buildFloorPlan(findings, true).find(
      (floor) => floor.dimension === "method",
    )!;
    const map = generateFloorFromPlan(plan, 42);

    expect(map.rooms).toHaveLength(7);
    expect(map.rooms.map((room) => room.monsterSpawns?.length)).toEqual([
      1, 1, 1, 1, 1, 1, 1,
    ]);
    expect(map.rooms.at(-1)!.isBoss).toBe(true);
    expect(map.rooms.at(-1)!.findingIds).toEqual([findings[0]!.id]);
    expect(map.tiles.some((row) => row.includes(TileCode.STAIRS))).toBe(true);
  });

  it("keeps Ghost and Throne as special single-monster rooms", () => {
    const plan = buildFloorPlan([], true);
    const ghost = generateFloorFromPlan(plan[0]!, 7);
    const throne = generateFloorFromPlan(plan[1]!, 7);

    expect(ghost.dimension).toBe("ghost");
    expect(ghost.bossSlug).toBe("nyxara");
    expect(ghost.rooms[0]!.kind).toBe("special");
    expect(ghost.rooms[0]!.findingId).toBeNull();
    expect(ghost.rooms[0]!.monsterSpawns).toHaveLength(1);

    expect(throne.dimension).toBe("throne");
    expect(throne.bossSlug).toBe("eldravos");
    expect(throne.rooms[0]!.kind).toBe("special");
  });

  it("keeps the first door open and locks later doors", () => {
    const findings = [
      finding("gap_unsupported", 1),
      finding("gap_answered_by_own_refs", 2),
      finding("gap_unsupported", 3),
      finding("gap_unsupported", 4),
    ];
    const plan = buildFloorPlan(findings, true).find(
      (floor) => floor.dimension === "gap",
    )!;
    const map = generateFloorFromPlan(plan, 11);
    const doors = map.rooms.map((room) =>
      room.entranceDoor
        ? map.tiles[room.entranceDoor.y]?.[room.entranceDoor.x]
        : null,
    );

    expect(doors[0]).toBe(TileCode.DOOR_OPEN);
    expect(doors.slice(1).every((code) => code === TileCode.DOOR_LOCKED)).toBe(true);
  });

  it("builds a connected serpentine layout, not one straight corridor", () => {
    const findings = Array.from({ length: 7 }, (_, index) =>
      finding("sample_unreported", index + 1),
    );
    const plan = buildFloorPlan(findings, true).find(
      (floor) => floor.dimension === "method",
    )!;
    const map = generateFloorFromPlan(plan, 42);

    const roomYs = map.rooms.map((room) => room.rect.y);
    expect(new Set(roomYs).size).toBeGreaterThan(1);

    const seen = new Set<string>();
    const queue = [map.playerSpawn];
    while (queue.length > 0) {
      const point = queue.shift()!;
      const key = `${point.x},${point.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = point.x + dx;
        const ny = point.y + dy;
        const code = (map.tiles[ny]?.[nx] ?? TileCode.VOID) as TileCode;
        if (code === TileCode.VOID) continue;
        if (isSolid(code) && code !== TileCode.DOOR_LOCKED) continue;
        queue.push({ x: nx, y: ny });
      }
    }

    for (const room of map.rooms) {
      expect(seen.has(`${room.monsterSpawn.x},${room.monsterSpawn.y}`)).toBe(true);
    }
    expect(seen.has(`${map.stairs.x},${map.stairs.y}`)).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    const findings = [finding("sample_unreported", 1), finding("sample_unreported", 2)];
    const plan = buildFloorPlan(findings, true)[0]!;
    expect(generateFloorFromPlan(plan, 99)).toEqual(generateFloorFromPlan(plan, 99));
    expect(generateFloorFromPlan(plan, 99)).not.toEqual(generateFloorFromPlan(plan, 100));
  });
});
