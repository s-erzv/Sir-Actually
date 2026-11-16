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
  it("keeps every planned room, adds maze chambers, and spawns one monster per finding", () => {
    const findings = Array.from({ length: 7 }, (_, index) =>
      finding("sample_unreported", index + 1),
    );
    const plan = buildFloorPlan(findings, true).find(
      (floor) => floor.dimension === "method",
    )!;
    const map = generateFloorFromPlan(plan, 42);

    const populated = map.rooms.filter((room) => (room.findingIds?.length ?? 0) > 0);
    expect(populated).toHaveLength(plan.rooms.length);
    expect(map.rooms.length).toBe(plan.rooms.length); // filler cells are corridors

    const plannedSpawns = plan.rooms.reduce((sum, room) => sum + room.monsterIds.length, 0);
    const actualSpawns = map.rooms.reduce(
      (sum, room) => sum + (room.monsterSpawns?.length ?? 0),
      0,
    );
    expect(actualSpawns).toBe(plannedSpawns);
    for (const room of populated) {
      expect(room.monsterSpawns?.length).toBe(room.findingIds!.length);
    }

    for (const room of map.rooms) {
      for (const spawn of room.monsterSpawns ?? []) {
        expect(isSolid(map.tiles[spawn.y]?.[spawn.x] as TileCode)).toBe(false);
      }
    }
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

  it("locks only the boss gate; maze branches stay open", () => {
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

    const boss = map.rooms.find((room) => room.isBoss)!;
    expect(boss.entranceDoor).not.toBeNull();
    expect(map.tiles[boss.entranceDoor!.y]![boss.entranceDoor!.x]).toBe(
      TileCode.DOOR_LOCKED,
    );

    const otherDoors = map.rooms.filter((room) => !room.isBoss && room.entranceDoor);
    expect(otherDoors.length).toBeGreaterThan(0);
    for (const room of otherDoors) {
      expect(map.tiles[room.entranceDoor!.y]![room.entranceDoor!.x]).toBe(
        TileCode.DOOR_OPEN,
      );
    }
  });

  it("builds a branching, connected maze instead of one hallway", () => {
    const findings = Array.from({ length: 7 }, (_, index) =>
      finding("sample_unreported", index + 1),
    );
    const plan = buildFloorPlan(findings, true).find(
      (floor) => floor.dimension === "method",
    )!;
    const map = generateFloorFromPlan(plan, 42);

    const cols = new Set(map.rooms.map((room) => room.rect.x));
    const rows = new Set(map.rooms.map((room) => room.rect.y));
    expect(cols.size).toBeGreaterThan(1);
    expect(rows.size).toBeGreaterThan(1);

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
      for (const spawn of room.monsterSpawns ?? []) {
        expect(seen.has(`${spawn.x},${spawn.y}`)).toBe(true);
      }
    }
    expect(seen.has(`${map.stairs.x},${map.stairs.y}`)).toBe(true);

    const passable = (x: number, y: number) => {
      const code = map.tiles[y]?.[x];
      return (
        code === TileCode.FLOOR ||
        code === TileCode.FLOOR_ALT ||
        code === TileCode.DOOR_OPEN ||
        code === TileCode.DOOR_LOCKED
      );
    };
    const openings = map.rooms.map((room) => {
      const { x, y, width, height } = room.rect;
      const sideOpen = (
        fromX: number,
        fromY: number,
        dx: number,
        dy: number,
        length: number,
      ) =>
        Array.from({ length }, (_, index) =>
          passable(fromX + dx * index, fromY + dy * index),
        ).some(Boolean);

      return [
        sideOpen(x - 1, y, 0, 1, height),
        sideOpen(x + width, y, 0, 1, height),
        sideOpen(x, y - 1, 1, 0, width),
        sideOpen(x, y + height, 1, 0, width),
      ].filter(Boolean).length;
    });
    expect(Math.max(...openings)).toBeGreaterThanOrEqual(3);
  });

  it("is deterministic for the same seed", () => {
    const findings = [finding("sample_unreported", 1), finding("sample_unreported", 2)];
    const plan = buildFloorPlan(findings, true)[0]!;
    expect(generateFloorFromPlan(plan, 99)).toEqual(generateFloorFromPlan(plan, 99));
    expect(generateFloorFromPlan(plan, 99)).not.toEqual(generateFloorFromPlan(plan, 100));
  });
});
