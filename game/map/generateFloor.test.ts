import { describe, it, expect } from "vitest";
import { generateFloor } from "./generateFloor";
import { TileCode, isSolid } from "./tiles";
import type { FindingStub, Vec2 } from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFindings(n: number, floor: 1 | 2 | 3 | 4): FindingStub[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `finding-${floor}-${i}`,
    weaknessType: "gap_unsupported" as const,
    severity: 2 as const,
    centrality: 2 as const,
    confidence: 0.8,
    evidenceQuote: `quote ${i}`,
    floor,
    rank: i + 1,
  }));
}

type Tiles = number[][];

function tileAt(tiles: Tiles, x: number, y: number): TileCode {
  return (tiles[y]?.[x] ?? TileCode.VOID) as TileCode;
}

function isWalkable(code: TileCode): boolean {
  return (
    code === TileCode.FLOOR ||
    code === TileCode.FLOOR_ALT ||
    code === TileCode.DOOR_LOCKED ||
    code === TileCode.DOOR_OPEN ||
    code === TileCode.STAIRS
  );
}

/**
 * BFS from start to end on the tile grid.
 * @param treatLockedAsSolid if true, DOOR_LOCKED blocks movement
 */
function bfsReachable(
  tiles: Tiles,
  start: Vec2,
  treatLockedAsSolid: boolean,
): Set<string> {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  const visited = new Set<string>();
  const queue: Vec2[] = [start];
  visited.add(`${start.x},${start.y}`);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const neighbours: Vec2[] = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x,     y: cur.y + 1 },
      { x: cur.x,     y: cur.y - 1 },
    ];
    for (const nb of neighbours) {
      if (nb.x < 0 || nb.y < 0 || nb.x >= w || nb.y >= h) continue;
      const key = `${nb.x},${nb.y}`;
      if (visited.has(key)) continue;
      const code = tileAt(tiles, nb.x, nb.y) as TileCode;
      if (code === TileCode.VOID) continue;
      if (isSolid(code)) {
        // DOOR_LOCKED is solid per isSolid(); but if treatLockedAsSolid is false, allow it
        if (code === TileCode.DOOR_LOCKED && !treatLockedAsSolid) {
          // passable
        } else {
          continue;
        }
      }
      visited.add(key);
      queue.push(nb);
    }
  }
  return visited;
}

// ---------------------------------------------------------------------------
// M1 tests (preserved, updated for new TileCode values)
// ---------------------------------------------------------------------------

describe("generateFloor — M1 invariants", () => {
  it("throws when findings array is empty", () => {
    expect(() => generateFloor([], 1, 0)).toThrow("findings must not be empty");
  });

  it("number of rooms equals number of findings", () => {
    const findings = makeFindings(3, 1);
    const map = generateFloor(findings, 1, 42);
    expect(map.rooms).toHaveLength(3);
  });

  it("last room is the boss room", () => {
    const findings = makeFindings(3, 1);
    const map = generateFloor(findings, 1, 42);
    const bossRoom = map.rooms[map.rooms.length - 1];
    expect(bossRoom.isBoss).toBe(true);
    map.rooms.slice(0, -1).forEach((r) => expect(r.isBoss).toBe(false));
  });

  it("boss room is wider and taller than regular rooms", () => {
    const findings = makeFindings(3, 1);
    const map = generateFloor(findings, 1, 42);
    const bossRoom  = map.rooms[map.rooms.length - 1];
    const regularRoom = map.rooms[0];
    expect(bossRoom.rect.width).toBeGreaterThan(regularRoom.rect.width);
    expect(bossRoom.rect.height).toBeGreaterThan(regularRoom.rect.height);
  });

  it("stairs tile exists in the tilemap", () => {
    const findings = makeFindings(2, 2);
    const map = generateFloor(findings, 2, 99);
    const hasStairs = map.tiles.some(row => row.includes(TileCode.STAIRS));
    expect(hasStairs).toBe(true);
  });

  it("output is deterministic for the same seed", () => {
    const findings = makeFindings(4, 3);
    const mapA = generateFloor(findings, 3, 1234);
    const mapB = generateFloor(findings, 3, 1234);
    expect(mapA.tiles).toEqual(mapB.tiles);
    expect(mapA.rooms.map(r => r.rect)).toEqual(mapB.rooms.map(r => r.rect));
  });

  it("different seed produces different decor (tile arrays differ)", () => {
    const findings = makeFindings(4, 3);
    const mapA = generateFloor(findings, 3, 1234);
    const mapC = generateFloor(findings, 3, 9999);
    expect(mapA.tiles).not.toEqual(mapC.tiles);
  });

  it("locked doors exist between rooms for N > 1", () => {
    const findings = makeFindings(3, 1);
    const map = generateFloor(findings, 1, 7);
    const hasLocked = map.tiles.some(row => row.includes(TileCode.DOOR_LOCKED));
    expect(hasLocked).toBe(true);
    // Rooms 1+ should have an entrance door
    map.rooms.slice(1).forEach(r => expect(r.entranceDoor).not.toBeNull());
  });

  it("boss room maps to highest-rank finding", () => {
    const findings = makeFindings(3, 1);
    const map = generateFloor(findings, 1, 42);
    const bossRoom = map.rooms[map.rooms.length - 1];
    // rank 3 is highest, index 2
    expect(bossRoom.findingId).toBe("finding-1-2");
  });

  it("playerSpawn is inside the start room floor area", () => {
    const findings = makeFindings(2, 1);
    const map = generateFloor(findings, 1, 5);
    const { playerSpawn, tiles } = map;
    const code = tileAt(tiles, playerSpawn.x, playerSpawn.y);
    expect(
      code === TileCode.FLOOR || code === TileCode.FLOOR_ALT
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// M2b tests — dinding envelope, BFS reachability, prop constraints
// ---------------------------------------------------------------------------

describe("generateFloor — M2b invariants", () => {
  it("every FLOOR tile has no VOID in its 8 neighbours", () => {
    const findings = makeFindings(3, 1);
    const map = generateFloor(findings, 1, 777);
    const { tiles } = map;
    const h = tiles.length;
    const w = tiles[0]?.length ?? 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const code = tileAt(tiles, x, y);
        if (code !== TileCode.FLOOR && code !== TileCode.FLOOR_ALT) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nb = tileAt(tiles, x + dx, y + dy);
            expect(nb).not.toBe(TileCode.VOID);
          }
        }
      }
    }
  });

  it("BFS from playerSpawn reaches stairs when doors are passable", () => {
    const findings = makeFindings(3, 1);
    const map = generateFloor(findings, 1, 42);
    const reachable = bfsReachable(map.tiles, map.playerSpawn, false);
    const stairsKey = `${map.stairs.x},${map.stairs.y}`;
    expect(reachable.has(stairsKey)).toBe(true);
  });

  it("BFS from playerSpawn is limited when doors are solid (locked)", () => {
    const findings = makeFindings(3, 1);
    const map = generateFloor(findings, 1, 42);
    // With locked doors treated as solid, player cannot reach boss room
    const reachable = bfsReachable(map.tiles, map.playerSpawn, true);
    const stairsKey = `${map.stairs.x},${map.stairs.y}`;
    // Stairs is in the boss room, should NOT be reachable with all doors locked
    expect(reachable.has(stairsKey)).toBe(false);
  });

  it("no PROP at any door position or adjacent to a door", () => {
    const findings = makeFindings(3, 1);
    const map = generateFloor(findings, 1, 55);
    const { tiles, rooms } = map;

    for (const room of rooms) {
      if (!room.entranceDoor) continue;
      const { x: dx, y: dy } = room.entranceDoor;

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const code = tileAt(tiles, dx + ox, dy + oy);
          expect(code).not.toBe(TileCode.PROP);
        }
      }
    }
  });

  it("no PROP at monsterSpawn or adjacent tile", () => {
    const findings = makeFindings(3, 1);
    const map = generateFloor(findings, 1, 123);

    for (const room of map.rooms) {
      const { x: mx, y: my } = room.monsterSpawn;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const code = tileAt(map.tiles, mx + ox, my + oy);
          expect(code).not.toBe(TileCode.PROP);
        }
      }
    }
  });

  it("same seed → identical tiles; different seed → different decor but same structure", () => {
    const f = makeFindings(3, 1);
    const a = generateFloor(f, 1, 999);
    const b = generateFloor(f, 1, 999);
    const c = generateFloor(f, 1, 12345);

    expect(a.tiles).toEqual(b.tiles);
    // Same room rects regardless of seed
    expect(a.rooms.map(r => r.rect)).toEqual(c.rooms.map(r => r.rect));
    // Different seeds → different FLOOR_ALT placements → tiles differ
    expect(a.tiles).not.toEqual(c.tiles);
  });
});
