import { describe, expect, it } from "vitest";
import { buildFloorPlan } from "./buildFloorPlan";
import { generateFloorFromPlan } from "./generateFloor";
import { TileCode, isSolid } from "./tiles";
import type { FindingStub, FloorMap, FloorPlan, WeaknessType } from "@/lib/domain/types";

function finding(id: string, weaknessType: WeaknessType, rank: number): FindingStub {
  return {
    id,
    weaknessType,
    severity: 2,
    centrality: 2,
    confidence: 0.8,
    evidenceQuote: `kutipan ${id}`,
    floor: 1,
    rank,
  };
}

function methodPlan(count: number): FloorPlan {
  const types: WeaknessType[] = [
    "rq_method_mismatch",
    "sample_unreported",
    "generalization_beyond_sample",
    "limitation_missing",
  ];
  const findings = Array.from({ length: count }, (_, index) =>
    finding(`f${index}`, types[index % types.length]!, index + 1),
  );
  return buildFloorPlan(findings, true)[0]!;
}

const walkable = (map: FloorMap, x: number, y: number): boolean => {
  const code = (map.tiles[y]?.[x] ?? TileCode.VOID) as TileCode;
  return code !== TileCode.VOID && !isSolid(code);
};

/** Tiles reachable from the spawn; locked doors count as passable when asked. */
function reach(map: FloorMap, throughLocked: boolean): Set<string> {
  const seen = new Set<string>([`${map.playerSpawn.x},${map.playerSpawn.y}`]);
  const queue = [map.playerSpawn];
  for (let head = 0; head < queue.length; head++) {
    const { x, y } = queue[head]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      const locked = map.tiles[ny]?.[nx] === TileCode.DOOR_LOCKED;
      if (!(walkable(map, nx, ny) || (throughLocked && locked))) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

describe("generateFloorFromPlan (labirin)", () => {
  it("satu ruang per temuan, satu monster per ruang, boss terakhir", () => {
    for (const count of [1, 2, 6, 14]) {
      const plan = methodPlan(count);
      const map = generateFloorFromPlan(plan, 20261101);
      expect(map.rooms).toHaveLength(plan.rooms.length);
      expect(map.rooms.at(-1)!.isBoss).toBe(true);
      expect(map.rooms.filter((room) => room.isBoss)).toHaveLength(1);
      for (const room of map.rooms) {
        expect(room.monsterSpawns).toHaveLength(1);
        expect(room.findingIds).toHaveLength(1);
      }
      const spawns = map.rooms.map((room) => `${room.monsterSpawn.x},${room.monsterSpawn.y}`);
      expect(new Set(spawns).size).toBe(spawns.length);
      const ids = map.rooms.flatMap((room) => room.findingIds ?? []);
      expect(new Set(ids).size).toBe(count);
    }
  });

  it("hanya gerbang boss yang terkunci; semua sarang antek terbuka", () => {
    const map = generateFloorFromPlan(methodPlan(6), 7);
    const locked = map.tiles.flat().filter((code) => code === TileCode.DOOR_LOCKED);
    expect(locked).toHaveLength(1);
    const boss = map.rooms.at(-1)!;
    expect(map.tiles[boss.entranceDoor!.y]![boss.entranceDoor!.x]).toBe(TileCode.DOOR_LOCKED);
    for (const room of map.rooms.slice(0, -1)) {
      expect(map.tiles[room.entranceDoor!.y]![room.entranceDoor!.x]).toBe(TileCode.DOOR_OPEN);
    }
  });

  it("boss tunggal tanpa antek tidak dikunci", () => {
    const map = generateFloorFromPlan(methodPlan(1), 7);
    expect(map.tiles.flat()).not.toContain(TileCode.DOOR_LOCKED);
  });

  it("semua antek terjangkau sebelum gerbang boss; boss dan tangga setelahnya", () => {
    for (const seed of [1, 7, 20261101, 20261104]) {
      const map = generateFloorFromPlan(methodPlan(6), seed);
      const before = reach(map, false);
      const after = reach(map, true);
      const boss = map.rooms.at(-1)!;
      for (const room of map.rooms.slice(0, -1)) {
        expect(before.has(`${room.monsterSpawn.x},${room.monsterSpawn.y}`)).toBe(true);
      }
      expect(before.has(`${boss.monsterSpawn.x},${boss.monsterSpawn.y}`)).toBe(false);
      expect(after.has(`${boss.monsterSpawn.x},${boss.monsterSpawn.y}`)).toBe(true);
      // Stairs are a trigger tile next to walkable floor inside the boss room.
      const nextToStairs = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
        after.has(`${map.stairs.x + dx!},${map.stairs.y + dy!}`),
      );
      expect(map.tiles[map.stairs.y]![map.stairs.x]).toBe(TileCode.STAIRS);
      expect(nextToStairs).toBe(true);
    }
  });

  it("terasa labirin: lorong bercabang, ada jalan buntu, tanpa lorong lurus panjang", () => {
    const map = generateFloorFromPlan(methodPlan(6), 20261101);
    const inRoom = (x: number, y: number) =>
      map.rooms.some(
        (room) =>
          x >= room.rect.x &&
          x < room.rect.x + room.rect.width &&
          y >= room.rect.y &&
          y < room.rect.y + room.rect.height,
      );
    let junctions = 0;
    let corridorTiles = 0;
    let longestRun = 0;
    for (let y = 0; y < map.height; y++) {
      let run = 0;
      for (let x = 0; x < map.width; x++) {
        const isCorridor = walkable(map, x, y) && !inRoom(x, y);
        run = isCorridor ? run + 1 : 0;
        longestRun = Math.max(longestRun, run);
        if (!isCorridor) continue;
        corridorTiles++;
        const exits = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) =>
          walkable(map, x + dx!, y + dy!),
        ).length;
        if (exits >= 3) junctions++;
      }
    }
    expect(junctions).toBeGreaterThanOrEqual(6);
    expect(map.deadEnds!.length).toBeGreaterThanOrEqual(2);
    expect(corridorTiles).toBeGreaterThan(120);
    expect(longestRun).toBeLessThanOrEqual(22);
    // Compact: the old cell grid was 94x78 for the same plan.
    expect(map.width * map.height).toBeLessThan(2400);
  });

  it("jalan buntu berisi jarahan yang bisa didatangi", () => {
    const map = generateFloorFromPlan(methodPlan(6), 20261101);
    const before = reach(map, false);
    for (const tip of map.deadEnds!) {
      expect(before.has(`${tip.x},${tip.y}`)).toBe(true);
    }
  });

  it("Ghost dan Takhta tetap satu ruang khusus", () => {
    const plans = buildFloorPlan([finding("a", "sample_unreported", 1)], true);
    for (const plan of plans.filter((item) => item.dimension !== "method")) {
      const map = generateFloorFromPlan(plan, 3);
      expect(map.rooms).toHaveLength(1);
      expect(map.rooms[0]!.kind).toBe("special");
      expect(map.tiles.flat()).not.toContain(TileCode.DOOR_LOCKED);
    }
  });

  it("deterministik untuk seed yang sama, berbeda untuk seed lain", () => {
    const plan = methodPlan(6);
    expect(generateFloorFromPlan(plan, 11)).toEqual(generateFloorFromPlan(plan, 11));
    expect(generateFloorFromPlan(plan, 11).tiles).not.toEqual(generateFloorFromPlan(plan, 12).tiles);
  });
});
