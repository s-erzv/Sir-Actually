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
const ROOM_INNER_W   = 7;
const ROOM_INNER_H   = 5;
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

const CELL_GAP = 7;
const MAP_MARGIN = 3;

function dungeonPath(count: number): Vec2[] {
  const rows = count <= 4 ? 2 : count <= 6 ? 2 : 3;
  const cols = Math.max(1, Math.ceil(count / rows));
  const cells: Vec2[] = [];
  for (let row = rows - 1; row >= 0; row -= 1) {
    const rowIndex = rows - 1 - row;
    const columns = Array.from({ length: cols }, (_, index) => index);
    const order = rowIndex % 2 === 0 ? columns : columns.reverse();
    for (const col of order) cells.push({ x: col, y: row });
  }
  return cells.slice(0, count);
}

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
 * Legacy serpentine generator kept for comparison/tests. New floors use the
 * maze generator below.
 */
export function generateSerpentineFloorFromPlan(plan: FloorPlan, seed: number): FloorMap {
  if (plan.rooms.length === 0) {
    throw new Error("generateFloorFromPlan: plan must contain at least one room");
  }

  const rand = mulberry32(seed);
  const cellCount = plan.rooms.length + 1;
  const path = dungeonPath(cellCount);
  const rows = Math.max(...path.map((cell) => cell.y)) + 1;
  const cols = Math.max(...path.map((cell) => cell.x)) + 1;
  const cellW = BOSS_OUTER_W + CELL_GAP;
  const cellH = BOSS_OUTER_H + CELL_GAP;
  const totalWidth = MAP_MARGIN * 2 + cols * cellW;
  const totalHeight = MAP_MARGIN * 2 + rows * cellH;

  const tiles = createGrid(totalWidth, totalHeight);
  const cellCentre = (cell: Vec2) => ({
    x: Math.round(MAP_MARGIN + cell.x * cellW + cellW / 2),
    y: Math.round(MAP_MARGIN + cell.y * cellH + cellH / 2),
  });

  const startCell = path[0]!;
  const startCentre = cellCentre(startCell);
  const startRect: Rect = {
    x: startCentre.x - Math.floor(START_OUTER_W / 2),
    y: startCentre.y - Math.floor(START_OUTER_H / 2),
    width: START_OUTER_W,
    height: START_OUTER_H,
  };
  buildRoom(
    tiles,
    startRect.x,
    startRect.y,
    startRect.width,
    startRect.height,
    false,
    rand,
    new Set<string>(),
    { x: -999, y: -999 },
  );

  const playerSpawn: Vec2 = {
    x: startRect.x + OUTER_PAD + 1,
    y: startCentre.y,
  };

  const rooms: Room[] = [];
  const doorPositionsMap = new Set<string>();
  let stairs: Vec2 = { x: 0, y: 0 };

  const plannedRects = plan.rooms.map((plannedRoom, index) => {
    const cell = path[index + 1]!;
    const centre = cellCentre(cell);
    const outerW = plannedRoom.kind === "minions" ? ROOM_OUTER_W : BOSS_OUTER_W;
    const outerH = plannedRoom.kind === "minions" ? ROOM_OUTER_H : BOSS_OUTER_H;
    return {
      plannedRoom,
      centre,
      outerW,
      outerH,
      rect: {
        x: centre.x - Math.floor(outerW / 2),
        y: centre.y - Math.floor(outerH / 2),
        width: outerW,
        height: outerH,
      } satisfies Rect,
    };
  });

  plannedRects.forEach((item, index) => {
    const { plannedRoom, rect, outerW, outerH, centre } = item;
    const isBoss = plannedRoom.kind !== "minions";
    const monsterSpawns = spawnsForRoom(
      rect.x,
      outerW,
      centre.y,
      isBoss ? 1 : plannedRoom.monsterIds.length,
      isBoss,
    );

    buildRoom(
      tiles,
      rect.x,
      rect.y,
      outerW,
      outerH,
      isBoss,
      rand,
      doorPositionsMap,
      monsterSpawns[0]!,
    );

    if (index === plannedRects.length - 1) {
      const stairsX = rect.x + outerW - OUTER_PAD - 1;
      const stairsY = centre.y;
      set(tiles, stairsX, stairsY, TileCode.STAIRS);
      stairs = { x: stairsX, y: stairsY };
    }

    rooms.push({
      id: `f${plan.floorOrder}-r${index}`,
      findingId: plannedRoom.monsterIds[0] ?? null,
      findingIds: plannedRoom.monsterIds,
      rect,
      isBoss,
      monsterSpawn: monsterSpawns[0]!,
      monsterSpawns,
      entranceDoor: null,
      kind: plannedRoom.kind,
      bossSlug: plan.bossSlug,
    });
  });

  // Connect every room to the next one along the serpentine grid path.
  for (let index = 0; index < plannedRects.length; index += 1) {
    const previous =
      index === 0
        ? { rect: startRect, centre: startCentre }
        : { rect: plannedRects[index - 1]!.rect, centre: plannedRects[index - 1]!.centre };
    const current = plannedRects[index]!;
    const horizontal = previous.centre.y === current.centre.y;
    let door: Vec2;

    if (horizontal) {
      const movingRight = current.centre.x > previous.centre.x;
      const y = previous.centre.y;
      if (movingRight) {
        buildHorizontalCorridor(
          tiles,
          previous.rect.x + previous.rect.width,
          current.rect.x - 1,
          y,
        );
        set(tiles, previous.rect.x + previous.rect.width - 1, y, TileCode.FLOOR);
        set(tiles, current.rect.x, y, TileCode.FLOOR);
        door = { x: current.rect.x - 1, y };
      } else {
        buildHorizontalCorridor(
          tiles,
          current.rect.x + current.rect.width,
          previous.rect.x - 1,
          y,
        );
        set(tiles, previous.rect.x, y, TileCode.FLOOR);
        set(tiles, current.rect.x + current.rect.width - 1, y, TileCode.FLOOR);
        door = { x: current.rect.x + current.rect.width, y };
      }
    } else {
      const movingDown = current.centre.y > previous.centre.y;
      const x = previous.centre.x;
      if (movingDown) {
        buildVerticalCorridor(
          tiles,
          x,
          previous.rect.y + previous.rect.height,
          current.rect.y - 1,
        );
        set(tiles, x, previous.rect.y + previous.rect.height - 1, TileCode.FLOOR);
        set(tiles, x, current.rect.y, TileCode.FLOOR);
        door = { x, y: current.rect.y - 1 };
      } else {
        buildVerticalCorridor(
          tiles,
          x,
          current.rect.y + current.rect.height,
          previous.rect.y - 1,
        );
        set(tiles, x, previous.rect.y, TileCode.FLOOR);
        set(tiles, x, current.rect.y + current.rect.height - 1, TileCode.FLOOR);
        door = { x, y: current.rect.y + current.rect.height };
      }
    }

    set(tiles, door.x, door.y, index === 0 ? TileCode.DOOR_OPEN : TileCode.DOOR_LOCKED);
    rooms[index]!.entranceDoor = door;

    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        doorPositionsMap.add(`${door.x + dx},${door.y + dy}`);
      }
    }
  }

  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width; x += 1) {
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

// ---------------------------------------------------------------------------
// Maze generator
// ---------------------------------------------------------------------------

interface MazeEdge {
  a: number;
  b: number;
}

const MAZE_DIRECTIONS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
] as const;

function mazeDimensions(count: number): { cols: number; rows: number } {
  if (count <= 2) return { cols: Math.max(1, count), rows: 1 };
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

/** Randomized DFS spanning tree over the cell grid: branches + dead ends. */
function buildMaze(cols: number, rows: number, rand: () => number): MazeEdge[] {
  const total = cols * rows;
  const visited = new Array<boolean>(total).fill(false);
  const edges: MazeEdge[] = [];
  const stack: number[] = [0];
  visited[0] = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1]!;
    const cx = current % cols;
    const cy = Math.floor(current / cols);
    const neighbors = MAZE_DIRECTIONS.map(({ dx, dy }) => ({
      x: cx + dx,
      y: cy + dy,
    }))
      .filter(({ x, y }) => x >= 0 && x < cols && y >= 0 && y < rows)
      .map(({ x, y }) => y * cols + x)
      .filter((cell) => !visited[cell]);

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const next = neighbors[Math.floor(rand() * neighbors.length)]!;
    visited[next] = true;
    edges.push({ a: current, b: next });
    stack.push(next);
  }

  // Braid: add a few loops between internal nodes. Leaves are left untouched,
  // so the boss still has exactly one entrance.
  const existing = new Set(edges.map((edge) => edgeKey(edge.a, edge.b)));
  const degree = new Array<number>(total).fill(0);
  for (const edge of edges) {
    degree[edge.a] += 1;
    degree[edge.b] += 1;
  }

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cell = y * cols + x;
      const neighbors = [
        x + 1 < cols ? cell + 1 : -1,
        y + 1 < rows ? cell + cols : -1,
      ].filter((next) => next >= 0);
      for (const next of neighbors) {
        const key = edgeKey(cell, next);
        if (existing.has(key)) continue;
        if (degree[cell]! < 2 || degree[next]! < 2) continue;
        if (rand() > 0.18) continue;
        existing.add(key);
        edges.push({ a: cell, b: next });
        degree[cell] += 1;
        degree[next] += 1;
      }
    }
  }

  return edges;
}

function mazeDistances(
  total: number,
  edges: readonly MazeEdge[],
): { distance: number[]; parent: number[] } {
  const adjacency: number[][] = Array.from({ length: total }, () => []);
  for (const edge of edges) {
    adjacency[edge.a]!.push(edge.b);
    adjacency[edge.b]!.push(edge.a);
  }

  const distance = new Array<number>(total).fill(-1);
  const parent = new Array<number>(total).fill(-1);
  distance[0] = 0;
  const queue = [0];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency[current]!) {
      if (distance[next] !== -1) continue;
      distance[next] = distance[current]! + 1;
      parent[next] = current;
      queue.push(next);
    }
  }

  return { distance, parent };
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function pointInRect(x: number, y: number, rect: Rect): boolean {
  return (
    x >= rect.x &&
    x < rect.x + rect.width &&
    y >= rect.y &&
    y < rect.y + rect.height
  );
}

/**
 * Carve an L-shaped corridor from one cell centre to another. This is what
 * makes the layout read as a labyrinth instead of boxes joined by straight
 * lines. Returns the first corridor tile inside the target rect (the door).
 */
function carvePath(
  tiles: number[][],
  fromCentre: Vec2,
  toRect: Rect,
  toCentre: Vec2,
  horizontalFirst: boolean,
): Vec2 | null {
  const points: Vec2[] = [];
  const append = (x: number, y: number) => {
    const last = points.at(-1);
    if (!last || last.x !== x || last.y !== y) points.push({ x, y });
  };

  if (horizontalFirst) {
    const dx = Math.sign(toCentre.x - fromCentre.x) || 1;
    for (let x = fromCentre.x; ; x += dx) {
      append(x, fromCentre.y);
      if (x === toCentre.x) break;
    }
    const dy = Math.sign(toCentre.y - fromCentre.y) || 1;
    for (let y = fromCentre.y; ; y += dy) {
      append(toCentre.x, y);
      if (y === toCentre.y) break;
    }
  } else {
    const dy = Math.sign(toCentre.y - fromCentre.y) || 1;
    for (let y = fromCentre.y; ; y += dy) {
      append(fromCentre.x, y);
      if (y === toCentre.y) break;
    }
    const dx = Math.sign(toCentre.x - fromCentre.x) || 1;
    for (let x = fromCentre.x; ; x += dx) {
      append(x, toCentre.y);
      if (x === toCentre.x) break;
    }
  }

  let door: Vec2 | null = null;
  let wasInside = false;
  for (const point of points) {
    set(tiles, point.x, point.y, TileCode.FLOOR);
    const inside = pointInRect(point.x, point.y, toRect);
    if (inside && !wasInside) door = point;
    wasInside = inside;
  }
  return door;
}

/** Surround every corridor tile outside a room with walls. */
function wallCorridors(tiles: number[][], roomRects: readonly Rect[]): void {
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  const inRoom = (x: number, y: number) => roomRects.some((rect) => pointInRect(x, y, rect));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (get(tiles, x, y) !== TileCode.FLOOR) continue;
      if (inRoom(x, y)) continue;
      for (const { dx, dy } of MAZE_DIRECTIONS) {
        const nx = x + dx;
        const ny = y + dy;
        if (get(tiles, nx, ny) === TileCode.VOID) {
          set(tiles, nx, ny, TileCode.WALL_TOP);
        }
      }
    }
  }
}

/**
 * Plan-driven maze generator.
 *
 * Every grid cell is a chamber: start, encounter rooms, boss, and empty
 * junction rooms that create branches and dead ends. The spanning tree is
 * deterministic for the seed; the boss sits on the farthest leaf and its door
 * stays locked until every minion is resolved.
 */
export function generateFloorFromPlan(plan: FloorPlan, seed: number): FloorMap {
  if (plan.rooms.length === 0) {
    throw new Error("generateFloorFromPlan: plan must contain at least one room");
  }

  const rand = mulberry32(seed);
  // Over-provision cells so filler cells become real corridor junctions and
  // dead ends, not extra rooms.
  const nodeCount = plan.rooms.length + 1;
  const extraCells =
    plan.dimension === "ghost" || plan.dimension === "throne"
      ? 2
      : Math.max(4, nodeCount);
  const targetCells = nodeCount + extraCells;
  const { cols, rows } = mazeDimensions(targetCells);
  const totalCells = cols * rows;
  const edges = buildMaze(cols, rows, rand);
  const { distance, parent } = mazeDistances(totalCells, edges);

  const cellW = BOSS_OUTER_W + CELL_GAP;
  const cellH = BOSS_OUTER_H + CELL_GAP;
  const totalWidth = MAP_MARGIN * 2 + cols * cellW;
  const totalHeight = MAP_MARGIN * 2 + rows * cellH;
  const tiles = createGrid(totalWidth, totalHeight);

  const startCell = 0;
  const candidates = Array.from({ length: totalCells }, (_, index) => index).filter(
    (cell) => cell !== startCell,
  );

  const degree = new Array<number>(totalCells).fill(0);
  for (const edge of edges) {
    degree[edge.a] += 1;
    degree[edge.b] += 1;
  }
  const leaves = candidates.filter((cell) => degree[cell] === 1);
  const bossPool = leaves.length > 0 ? leaves : candidates;
  let bossCell = bossPool[0]!;
  for (const cell of bossPool) {
    if (distance[cell]! > distance[bossCell]!) bossCell = cell;
  }

  const rest = candidates
    .filter((cell) => cell !== bossCell)
    .sort((a, b) => distance[a]! - distance[b]! || a - b);

  const minionPlans = plan.rooms.filter((room) => room.kind === "minions");
  const hasMinions = minionPlans.some((room) => room.monsterIds.length > 0);
  const bossPlan =
    plan.rooms.find((room) => room.kind !== "minions") ?? plan.rooms[plan.rooms.length - 1]!;

  const assignments = new Map<number, FloorPlan["rooms"][number]>();
  minionPlans.forEach((room, index) => {
    const cell = rest[index];
    if (cell !== undefined) assignments.set(cell, room);
  });
  assignments.set(bossCell, bossPlan);

  const isEncounterCell = (cell: number): boolean =>
    cell === bossCell || (assignments.get(cell)?.monsterIds.length ?? 0) > 0;

  const hash01 = (cell: number, salt: number): number => {
    let value = (cell + 1) * 374761393 + (salt + 1) * 668265263 + seed * 362437;
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
  };

  const cellCentre = (cell: number): Vec2 => {
    const base = {
      x: Math.round(MAP_MARGIN + (cell % cols) * cellW + cellW / 2),
      y: Math.round(MAP_MARGIN + Math.floor(cell / cols) * cellH + cellH / 2),
    };
    // Break the grid look: jitter rooms, but keep start/boss centred.
    if (cell === startCell || cell === bossCell) return base;
    return {
      x: base.x + Math.round((hash01(cell, 1) - 0.5) * 4),
      y: base.y + Math.round((hash01(cell, 2) - 0.5) * 4),
    };
  };

  const rectFor = (cell: number, outerW: number, outerH: number): Rect => {
    const centre = cellCentre(cell);
    return {
      x: centre.x - Math.floor(outerW / 2),
      y: centre.y - Math.floor(outerH / 2),
      width: outerW,
      height: outerH,
    };
  };

  // Vary minion chamber sizes so the floor is not a uniform grid of boxes.
  const minionSizes: Array<{ w: number; h: number }> = [
    { w: ROOM_OUTER_W, h: ROOM_OUTER_H },
    { w: ROOM_OUTER_W + 2, h: ROOM_OUTER_H },
    { w: ROOM_OUTER_W, h: ROOM_OUTER_H + 2 },
    { w: ROOM_OUTER_W + 2, h: ROOM_OUTER_H + 2 },
    { w: ROOM_OUTER_W + 4, h: ROOM_OUTER_H },
    { w: ROOM_OUTER_W + 4, h: ROOM_OUTER_H + 2 },
  ];
  const minionSize = (cell: number) =>
    minionSizes[Math.floor(hash01(cell, 3) * minionSizes.length)] ?? minionSizes[0]!;

  const startRect = rectFor(startCell, START_OUTER_W, START_OUTER_H);
  buildRoom(
    tiles,
    startRect.x,
    startRect.y,
    startRect.width,
    startRect.height,
    false,
    rand,
    new Set<string>(),
    { x: -999, y: -999 },
  );
  const playerSpawn: Vec2 = {
    x: startRect.x + OUTER_PAD + 1,
    y: cellCentre(startCell).y,
  };

  // Encounter cells get full rooms; filler cells stay open corridor junctions.
  const cellRects: Rect[] = Array.from({ length: totalCells }, (_, cell) => {
    if (cell === startCell) return startRect;
    if (cell === bossCell) return rectFor(cell, BOSS_OUTER_W, BOSS_OUTER_H);
    if (isEncounterCell(cell)) {
      const size = minionSize(cell);
      return rectFor(cell, size.w, size.h);
    }
    const centre = cellCentre(cell);
    return { x: centre.x, y: centre.y, width: 1, height: 1 };
  });

  const rooms: Room[] = [];
  let stairs: Vec2 = { x: 0, y: 0 };
  const roomCells = rest.filter(isEncounterCell);
  const orderedCells = [...roomCells, bossCell];

  for (const cell of orderedCells) {
    const plannedRoom = assignments.get(cell)!;
    const isBoss = cell === bossCell;
    const rect = cellRects[cell]!;
    const count = isBoss ? 1 : plannedRoom.monsterIds.length;
    const monsterSpawns =
      count > 0
        ? spawnsForRoom(rect.x, rect.width, cellCentre(cell).y, count, isBoss)
        : [];

    buildRoom(
      tiles,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      isBoss,
      rand,
      new Set<string>(),
      monsterSpawns[0] ?? { x: -999, y: -999 },
    );

    if (isBoss) {
      const stairsX = rect.x + rect.width - OUTER_PAD - 1;
      const stairsY = cellCentre(cell).y;
      stairs = { x: stairsX, y: stairsY };
    }

    rooms.push({
      id: `f${plan.floorOrder}-r${rooms.length}`,
      findingId: plannedRoom.monsterIds[0] ?? null,
      findingIds: plannedRoom.monsterIds,
      rect,
      isBoss,
      monsterSpawn: monsterSpawns[0] ?? { x: -999, y: -999 },
      monsterSpawns,
      entranceDoor: null,
      kind: plannedRoom.kind,
      bossSlug: plan.bossSlug,
    });
  }

  // Carve an L-shaped corridor per tree edge. The door sits on the child room,
  // while filler cells remain open junctions.
  const edgeDoors = new Map<string, Vec2>();
  for (const edge of edges) {
    const child = parent[edge.a] === edge.b ? edge.a : edge.b;
    const parentCell = child === edge.a ? edge.b : edge.a;
    const toCell = isEncounterCell(child)
      ? child
      : isEncounterCell(parentCell)
        ? parentCell
        : child;
    const fromCell = toCell === edge.a ? edge.b : edge.a;
    const horizontalFirst = (fromCell * 3 + toCell * 7 + seed) % 2 === 0;
    const door = carvePath(
      tiles,
      cellCentre(fromCell),
      cellRects[toCell]!,
      cellCentre(toCell),
      horizontalFirst,
    );
    if (door && isEncounterCell(toCell)) {
      edgeDoors.set(edgeKey(edge.a, edge.b), door);
      set(tiles, door.x, door.y, TileCode.DOOR_OPEN);
    }
  }

  wallCorridors(tiles, [startRect, ...orderedCells.map((cell) => cellRects[cell]!)]);

  // Each room's entrance is the door toward the start; the boss door is locked.
  for (const cell of orderedCells) {
    const room = rooms[orderedCells.indexOf(cell)]!;
    const from = parent[cell];
    if (from < 0) continue;
    const door = edgeDoors.get(edgeKey(from, cell));
    if (!door) continue;
    room.entranceDoor = door;
    if (cell === bossCell && hasMinions) {
      set(tiles, door.x, door.y, TileCode.DOOR_LOCKED);
    }
  }

  // Place stairs last so a corridor crossing the boss room cannot overwrite it.
  set(tiles, stairs.x, stairs.y, TileCode.STAIRS);

  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width; x += 1) {
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

  // Cut the four outer wall corners of minion rooms so they read less boxy.
  for (const room of rooms) {
    if (room.isBoss) continue;
    const { x, y, width: roomW, height: roomH } = room.rect;
    const corners: Array<[number, number]> = [
      [x, y],
      [x + roomW - 1, y],
      [x, y + roomH - 1],
      [x + roomW - 1, y + roomH - 1],
    ];
    for (const [cx, cy] of corners) {
      const code = get(tiles, cx, cy);
      if (code === TileCode.WALL_TOP || code === TileCode.WALL_FACE) {
        set(tiles, cx, cy, TileCode.VOID);
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
