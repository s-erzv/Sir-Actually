/**
 * generateFloor.ts v2 — Pure, deterministic dungeon floor generator.
 *
 * Design (BRIEF.md §10 + M2b prompt):
 *   Layout: horizontal sequence of rooms connected by 1-tile-wide corridors.
 *   - Start room: 7×5 interior (outer 9×7)
 *   - Regular rooms: 9×7 interior (outer 11×9), one per finding
 *   - Boss room: 13×9 interior (outer 15×11), last room
 *   - Corridors: 1 tile wide × 4 tiles long at map mid-Y
 *   - All rooms share the same vertical centre line
 *
 *   Tile codes (from tiles.ts):
 *   - VOID (0): outside rooms — transparent → background colour
 *   - WALL_TOP (1): solid wall tiles
 *   - FLOOR (2): walkable
 *   - WALL_FACE (3): wall row immediately above a floor row
 *   - DOOR_LOCKED (4): iron gate at corridor entrance
 *   - STAIRS (6): drawn on top of floor in boss room
 *   - WALL_DECOR (7): on WALL_FACE tiles every 4 tiles (north wall)
 *   - BANNER_RED (8): boss room north wall decor
 *   - FLOOR_ALT (9): cracked floor ~6% of floor tiles
 *   - PROP (10): barrel/chest in room corners
 *
 * No Phaser imports. Importable in Node/Vitest.
 */

import type { FindingStub, Floor, FloorMap, FloorPlan, Rect, Room, Vec2 } from "@/lib/domain/types";
import { TileCode } from "./tiles";

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32 (public domain)
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// Layout constants (all in tiles)
// ---------------------------------------------------------------------------

const START_INNER_W  = 7;
const START_INNER_H  = 5;
const ROOM_INNER_W   = 9;
const ROOM_INNER_H   = 7;
const BOSS_INNER_W   = 13;
const BOSS_INNER_H   = 9;
const CORRIDOR_LEN   = 4;   // tiles long
const OUTER_PAD      = 1;   // one WALL_TOP tile border around each room interior
const H_MARGIN       = 1;   // void tiles left/right of the whole map
const V_MARGIN       = 1;   // void tiles top/bottom of the whole map

// Outer sizes include the 1-tile wall border
const START_OUTER_W  = START_INNER_W + OUTER_PAD * 2;  // 9
const START_OUTER_H  = START_INNER_H + OUTER_PAD * 2;  // 7
const ROOM_OUTER_W   = ROOM_INNER_W  + OUTER_PAD * 2;  // 11
const ROOM_OUTER_H   = ROOM_INNER_H  + OUTER_PAD * 2;  // 9
const BOSS_OUTER_W   = BOSS_INNER_W  + OUTER_PAD * 2;  // 15
const BOSS_OUTER_H   = BOSS_INNER_H  + OUTER_PAD * 2;  // 11

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------

function createGrid(w: number, h: number): number[][] {
  return Array.from({ length: h }, () => Array<number>(w).fill(TileCode.VOID));
}

function set(tiles: number[][], x: number, y: number, code: TileCode): void {
  if (y >= 0 && y < tiles.length && x >= 0 && x < (tiles[0]?.length ?? 0)) {
    tiles[y][x] = code;
  }
}

function get(tiles: number[][], x: number, y: number): TileCode {
  const row = tiles[y];
  if (!row) return TileCode.VOID;
  return (row[x] ?? TileCode.VOID) as TileCode;
}

function fillRect(
  tiles: number[][],
  x: number,
  y: number,
  w: number,
  h: number,
  code: TileCode,
): void {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      set(tiles, col, row, code);
    }
  }
}

// ---------------------------------------------------------------------------
// Room builder — places floor + wall envelope
// ---------------------------------------------------------------------------

function buildRoom(
  tiles: number[][],
  rx: number,   // outer top-left x
  ry: number,   // outer top-left y
  outerW: number,
  outerH: number,
  isBoss: boolean,
  rand: () => number,
  doorPositions: Set<string>,
  monsterSpawnPos: Vec2,
): void {
  // 1. Fill outer border with WALL_TOP
  fillRect(tiles, rx, ry, outerW, outerH, TileCode.WALL_TOP);

  // 2. Fill interior with FLOOR
  const ix = rx + OUTER_PAD;
  const iy = ry + OUTER_PAD;
  const iw = outerW - OUTER_PAD * 2;
  const ih = outerH - OUTER_PAD * 2;
  fillRect(tiles, ix, iy, iw, ih, TileCode.FLOOR);

  // 3. North wall face: the top row of WALL_TOP that has floor directly below it
  //    = row ry (outer top row), cols ix..ix+iw-1
  for (let x = ix; x < ix + iw; x++) {
    set(tiles, x, ry, TileCode.WALL_FACE);
  }

  // 4. Wall decorations on north WALL_FACE every 4 tiles
  const decorCode = isBoss ? TileCode.BANNER_RED : TileCode.WALL_DECOR;
  for (let x = ix; x < ix + iw; x += 4) {
    set(tiles, x, ry, decorCode);
  }

  // 5. Cracked floor ~6% (FLOOR_ALT), skip corners, skip monsterSpawn, skip door adjacency
  const floorAltChance = 0.06;
  for (let row = iy; row < iy + ih; row++) {
    for (let col = ix; col < ix + iw; col++) {
      // Skip corners (2 tiles in from each corner edge)
      const nearLeftEdge  = col < ix + 2;
      const nearRightEdge = col >= ix + iw - 2;
      const nearTopEdge   = row <= iy;
      const nearBotEdge   = row >= iy + ih - 1;
      if ((nearLeftEdge || nearRightEdge) && (nearTopEdge || nearBotEdge)) continue;
      // Skip monster spawn
      if (col === monsterSpawnPos.x && row === monsterSpawnPos.y) continue;
      // Skip door adjacency
      if (doorPositions.has(`${col},${row}`)) continue;
      if (rand() < floorAltChance) {
        set(tiles, col, row, TileCode.FLOOR_ALT);
      }
    }
  }

  // 6. Props in two corners (bottom-left and bottom-right interior), skip if near door/spawn
  const propCandidates: Vec2[] = [
    { x: ix + 1,     y: iy + ih - 1 }, // bottom-left
    { x: ix + iw - 2, y: iy + ih - 1 }, // bottom-right
  ];
  for (const p of propCandidates) {
    if (doorPositions.has(`${p.x},${p.y}`)) continue;
    if (Math.abs(p.x - monsterSpawnPos.x) <= 1 && Math.abs(p.y - monsterSpawnPos.y) <= 1) continue;
    set(tiles, p.x, p.y, TileCode.PROP);
  }
}

// ---------------------------------------------------------------------------
// Corridor builder — fills floor + wall envelope for 1-tile-wide corridor
// ---------------------------------------------------------------------------

function buildCorridor(
  tiles: number[][],
  startX: number,  // x of first corridor tile (just east of previous room's east wall)
  midY: number,    // y of the walkable corridor tile
  length: number,
): void {
  for (let x = startX; x < startX + length; x++) {
    set(tiles, x, midY, TileCode.FLOOR);                // walkable centre
    set(tiles, x, midY - 1, TileCode.WALL_FACE);        // north wall face
    set(tiles, x, midY + 1, TileCode.WALL_TOP);         // south wall
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate a single dungeon floor from a list of findings.
 *
 * @param findings   Findings for this floor (length >= 1), will be sorted by rank.
 * @param floorOrder Which floor number (1–4).
 * @param seed       Integer seed for deterministic output.
 */
export function generateFloor(
  findings: FindingStub[],
  floorOrder: Floor,
  seed: number,
): FloorMap {
  if (findings.length === 0) {
    throw new Error("generateFloor: findings must not be empty");
  }

  const rand = mulberry32(seed);

  // Sort: lowest rank first, highest rank (boss) last
  const sorted = [...findings].sort((a, b) => a.rank - b.rank);
  const N = sorted.length; // number of regular rooms (not counting start room)

  // -------------------------------------------------------------------------
  // Calculate total map dimensions
  // -------------------------------------------------------------------------
  // Layout (left to right):
  //   H_MARGIN | startRoom | corridor | room0 | corridor | ... | bossRoom | H_MARGIN
  //
  // startRoom is always present (player start, no finding).
  // rooms 0..N-2 are regular rooms; rooms[N-1] is the boss room.

  const totalWidth =
    H_MARGIN +
    START_OUTER_W +
    (CORRIDOR_LEN + ROOM_OUTER_W) * Math.max(N - 1, 0) +
    (N > 0 ? CORRIDOR_LEN + BOSS_OUTER_W : 0) +
    H_MARGIN;

  // Height: tallest room (boss) centred with V_MARGIN on each side
  const tallest = BOSS_OUTER_H;
  const totalHeight = tallest + V_MARGIN * 2;

  const tiles = createGrid(totalWidth, totalHeight);

  // Vertical centre Y of the map (walkable corridor row)
  const midY = V_MARGIN + Math.floor(tallest / 2);

  // -------------------------------------------------------------------------
  // Place start room
  // -------------------------------------------------------------------------
  const startRoomX = H_MARGIN;
  const startRoomY = midY - Math.floor(START_OUTER_H / 2);

  // Start room has no finding — pass a sentinel spawn far off-screen
  const startMonsterSpawn: Vec2 = { x: -999, y: -999 };
  buildRoom(
    tiles,
    startRoomX, startRoomY,
    START_OUTER_W, START_OUTER_H,
    false, rand,
    new Set<string>(),
    startMonsterSpawn,
  );

  // Player spawns in the left-third of the start room
  const playerSpawn: Vec2 = {
    x: startRoomX + OUTER_PAD + 1,
    y: midY,
  };

  // -------------------------------------------------------------------------
  // Place regular rooms and boss room
  // -------------------------------------------------------------------------
  const rooms: Room[] = [];
  const doorPositionsMap = new Set<string>();
  let cursorX = startRoomX + START_OUTER_W; // east edge of start room

  // Open the east wall of the start room at midY so the corridor connects.
  // cursorX-1 is the last column of the start room's outer wall.
  set(tiles, cursorX - 1, midY, TileCode.FLOOR);

  // First door: start room → room 0 — use DOOR_OPEN (start room already open)
  // Subsequent doors: DOOR_LOCKED

  let stairs: Vec2 = { x: 0, y: 0 };

  for (let i = 0; i < N; i++) {
    const finding = sorted[i];
    const isBoss = i === N - 1;

    // Build corridor
    const corridorStartX = cursorX;
    buildCorridor(tiles, corridorStartX, midY, CORRIDOR_LEN);

    // Place door at start of corridor
    const doorX = corridorStartX;
    const doorY = midY;
    const doorCode = i === 0 ? TileCode.DOOR_OPEN : TileCode.DOOR_LOCKED;
    set(tiles, doorX, doorY, doorCode);

    // Mark door and adjacent positions for prop/dekor exclusion
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        doorPositionsMap.add(`${doorX + dx},${doorY + dy}`);
      }
    }

    const entranceDoor: Vec2 = { x: doorX, y: doorY };

    // Room placement
    const outerW = isBoss ? BOSS_OUTER_W : ROOM_OUTER_W;
    const outerH = isBoss ? BOSS_OUTER_H : ROOM_OUTER_H;
    const roomX = corridorStartX + CORRIDOR_LEN;
    const roomY = midY - Math.floor(outerH / 2);

    // Monster spawn: right-centre for regular rooms, centre for boss
    const monsterSpawn: Vec2 = isBoss
      ? { x: roomX + Math.floor(outerW / 2), y: midY }
      : { x: roomX + Math.floor(outerW * 2 / 3), y: midY };

    buildRoom(
      tiles,
      roomX, roomY,
      outerW, outerH,
      isBoss, rand,
      doorPositionsMap,
      monsterSpawn,
    );

    // Open the west wall of this room at midY so the corridor can enter,
    // and open the east wall of the previous room/corridor exit.
    // roomX is the west outer wall; roomX + outerW - 1 is the east outer wall.
    set(tiles, roomX, midY, TileCode.FLOOR);
    // The east wall of the previous room was already opened above (start room)
    // or will be opened below when the next corridor is added. But if this is
    // not the last room, open this room's east wall now for the next corridor.
    if (!isBoss) {
      set(tiles, roomX + outerW - 1, midY, TileCode.FLOOR);
    }

    // Stairs: one tile from east inner wall of boss room, on floor
    if (isBoss) {
      const stairsX = roomX + outerW - OUTER_PAD - 1;
      const stairsY = midY;
      set(tiles, stairsX, stairsY, TileCode.STAIRS);
      stairs = { x: stairsX, y: stairsY };
    }

    rooms.push({
      id: `f${floorOrder}-r${i}`,
      findingId: finding.id,
      rect: { x: roomX, y: roomY, width: outerW, height: outerH },
      isBoss,
      monsterSpawn,
      entranceDoor,
    });

    cursorX = roomX + outerW;
  }

  // -------------------------------------------------------------------------
  // Apply WALL_FACE pass: any WALL_TOP whose tile directly below is FLOOR/FLOOR_ALT
  // should become WALL_FACE (so the "front" of the wall is visible).
  // Do this AFTER all rooms are built to catch inter-room boundaries.
  // -------------------------------------------------------------------------
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const code = get(tiles, x, y);
      const below = get(tiles, x, y + 1);
      if (
        code === TileCode.WALL_TOP &&
        (below === TileCode.FLOOR || below === TileCode.FLOOR_ALT)
      ) {
        set(tiles, x, y, TileCode.WALL_FACE);
      }
    }
  }

  return {
    floorOrder,
    tiles,
    rooms,
    playerSpawn,
    stairs,
    width: totalWidth,
    height: totalHeight,
  };
}


// ---------------------------------------------------------------------------
// Plan-driven generator
// ---------------------------------------------------------------------------

function spawnsForRoom(
  roomX: number,
  outerW: number,
  midY: number,
  count: number,
  isBoss: boolean,
): Vec2[] {
  if (count < 1) throw new Error("generateFloorFromPlan: room must have a monster");
  if (isBoss) {
    return [{ x: roomX + Math.floor(outerW / 2), y: midY }];
  }

  const innerLeft = roomX + OUTER_PAD;
  const innerW = outerW - OUTER_PAD * 2;
  const gap = Math.max(1, Math.floor(innerW / (count + 1)));
  return Array.from({ length: count }, (_, index) => ({
    x: innerLeft + gap * (index + 1),
    y: midY,
  }));
}

const ROOM_OFFSETS = [0, -3, 3, -4, 4, -2, 2] as const;

function buildHorizontalCorridor(
  tiles: number[][],
  fromX: number,
  toX: number,
  y: number,
): void {
  for (let x = fromX; x <= toX; x += 1) {
    set(tiles, x, y, TileCode.FLOOR);
    set(tiles, x, y - 1, TileCode.WALL_FACE);
    set(tiles, x, y + 1, TileCode.WALL_TOP);
  }
}

function buildVerticalCorridor(
  tiles: number[][],
  x: number,
  fromY: number,
  toY: number,
): void {
  const step = toY >= fromY ? 1 : -1;
  for (let y = fromY; y !== toY + step; y += step) {
    set(tiles, x, y, TileCode.FLOOR);
    if (get(tiles, x - 1, y) !== TileCode.FLOOR && get(tiles, x - 1, y) !== TileCode.FLOOR_ALT) {
      set(tiles, x - 1, y, TileCode.WALL_TOP);
    }
    if (get(tiles, x + 1, y) !== TileCode.FLOOR && get(tiles, x + 1, y) !== TileCode.FLOOR_ALT) {
      set(tiles, x + 1, y, TileCode.WALL_TOP);
    }
  }
}

/**
 * Plan-driven generator with a serpentine dungeon layout: rooms step up and
 * down instead of sitting on one endless horizontal corridor.
 */
export function generateFloorFromPlan(plan: FloorPlan, seed: number): FloorMap {
  if (plan.rooms.length === 0) {
    throw new Error("generateFloorFromPlan: plan must contain at least one room");
  }

  const rand = mulberry32(seed);
  const totalWidth =
    H_MARGIN +
    START_OUTER_W +
    plan.rooms.reduce(
      (sum, room) =>
        sum + CORRIDOR_LEN + (room.kind === "minions" ? ROOM_OUTER_W : BOSS_OUTER_W),
      0,
    ) +
    H_MARGIN;

  const maxOffset = 4;
  const tallest = BOSS_OUTER_H;
  const totalHeight = tallest + V_MARGIN * 2 + maxOffset * 2;
  const tiles = createGrid(totalWidth, totalHeight);
  const centerY = Math.floor(totalHeight / 2);

  const startRoomX = H_MARGIN;
  const startRoomY = centerY - Math.floor(START_OUTER_H / 2);
  buildRoom(
    tiles,
    startRoomX,
    startRoomY,
    START_OUTER_W,
    START_OUTER_H,
    false,
    rand,
    new Set<string>(),
    { x: -999, y: -999 },
  );

  const playerSpawn: Vec2 = {
    x: startRoomX + OUTER_PAD + 1,
    y: centerY,
  };

  const rooms: Room[] = [];
  const doorPositionsMap = new Set<string>();
  let cursorX = startRoomX + START_OUTER_W;
  let previousExitY = centerY;
  set(tiles, cursorX - 1, previousExitY, TileCode.FLOOR);

  let stairs: Vec2 = { x: 0, y: 0 };

  plan.rooms.forEach((plannedRoom, index) => {
    const isBoss = plannedRoom.kind !== "minions";
    const outerW = isBoss ? BOSS_OUTER_W : ROOM_OUTER_W;
    const outerH = isBoss ? BOSS_OUTER_H : ROOM_OUTER_H;

    const roomX = cursorX + CORRIDOR_LEN;
    const offset = isBoss ? 0 : ROOM_OFFSETS[index % ROOM_OFFSETS.length]!;
    const roomY = centerY - Math.floor(outerH / 2) + offset;
    const entryY = roomY + Math.floor(outerH / 2);

    // L-shaped corridor: horizontal out of the previous room, then vertical
    // through the gap before the next room.
    buildHorizontalCorridor(tiles, cursorX, roomX - 1, previousExitY);
    buildVerticalCorridor(tiles, roomX - 1, previousExitY, entryY);

    const doorX = roomX - 1;
    const doorY = entryY;
    set(tiles, doorX, doorY, index === 0 ? TileCode.DOOR_OPEN : TileCode.DOOR_LOCKED);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        doorPositionsMap.add(`${doorX + dx},${doorY + dy}`);
      }
    }

    const entranceDoor: Vec2 = { x: doorX, y: doorY };
    const monsterSpawns = spawnsForRoom(
      roomX,
      outerW,
      entryY,
      isBoss ? 1 : plannedRoom.monsterIds.length,
      isBoss,
    );

    buildRoom(
      tiles,
      roomX,
      roomY,
      outerW,
      outerH,
      isBoss,
      rand,
      doorPositionsMap,
      monsterSpawns[0]!,
    );

    set(tiles, roomX, entryY, TileCode.FLOOR);
    if (index < plan.rooms.length - 1) {
      set(tiles, roomX + outerW - 1, entryY, TileCode.FLOOR);
    }

    if (index === plan.rooms.length - 1) {
      const stairsX = roomX + outerW - OUTER_PAD - 1;
      const stairsY = entryY;
      set(tiles, stairsX, stairsY, TileCode.STAIRS);
      stairs = { x: stairsX, y: stairsY };
    }

    rooms.push({
      id: `f${plan.floorOrder}-r${index}`,
      findingId: plannedRoom.monsterIds[0] ?? null,
      findingIds: plannedRoom.monsterIds,
      rect: { x: roomX, y: roomY, width: outerW, height: outerH },
      isBoss,
      monsterSpawn: monsterSpawns[0]!,
      monsterSpawns,
      entranceDoor,
      kind: plannedRoom.kind,
      bossSlug: plan.bossSlug,
    });

    cursorX = roomX + outerW;
    previousExitY = entryY;
  });

  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const code = get(tiles, x, y);
      const below = get(tiles, x, y + 1);
      if (
        code === TileCode.WALL_TOP &&
        (below === TileCode.FLOOR || below === TileCode.FLOOR_ALT)
      ) {
        set(tiles, x, y, TileCode.WALL_FACE);
      }
    }
  }

  return {
    floorOrder: plan.floorOrder,
    tiles,
    rooms,
    playerSpawn,
    stairs,
    width: totalWidth,
    height: totalHeight,
    dimension: plan.dimension,
    bossSlug: plan.bossSlug,
  };
}
