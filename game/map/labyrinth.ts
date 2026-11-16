/**
 * labyrinth.ts — pure, deterministic labyrinth floor generator.
 *
 * "Rooms and mazes": chambers are dropped onto an odd-coordinate lattice, every
 * remaining lattice cell is filled by a winding maze, each chamber opens onto
 * the maze through one door, then most dead ends are trimmed and a few walls
 * are knocked through so the maze has loops.
 *
 *   - one chamber per planned room, one monster per chamber
 *   - the boss chamber is the far side of the map, behind the only locked gate
 *   - corridors are one tile wide; surviving dead ends hold loot
 *
 * No Phaser imports. Same plan + seed always gives the same floor.
 */

import type { FloorMap, FloorPlan, Rect, Room, Vec2 } from "@/lib/domain/types";
import { TileCode } from "./tiles";

/** Interior sizes (odd so they sit on the lattice). */
const START_SIZE = { w: 5, h: 5 };
const BOSS_SIZE = { w: 11, h: 7 };
const DEN_SIZES = [
  { w: 5, h: 5 },
  { w: 7, h: 5 },
  { w: 5, h: 7 },
  { w: 7, h: 7 },
] as const;

/** Share of dead-end branches removed; the rest stay as loot nooks. */
const DEAD_END_TRIM = 0.62;
/** Longest dead-end branch kept, in tiles, so detours stay short. */
const DEAD_END_MAX_LEN = 7;
const FLOOR_ALT_CHANCE = 0.06;

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Chamber {
  /** Interior rect (floor only). */
  inner: Rect;
  role: "start" | "den" | "boss";
}

const odd = (value: number): number => (value % 2 === 0 ? value + 1 : value);

function overlapsWithGap(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x - gap <= b.x + b.width - 1 &&
    a.x + a.width - 1 + gap >= b.x &&
    a.y - gap <= b.y + b.height - 1 &&
    a.y + a.height - 1 + gap >= b.y
  );
}

/**
 * Place every chamber with at least wall-corridor-wall between any two and
 * between a chamber and the border. That ring is what keeps the maze one
 * connected piece. Returns null when the grid is too tight.
 */
function placeChambers(
  width: number,
  height: number,
  denCount: number,
  rand: () => number,
): Chamber[] | null {
  const placed: Chamber[] = [];
  const fits = (inner: Rect): boolean =>
    inner.x >= 3 &&
    inner.y >= 3 &&
    inner.x + inner.width - 1 <= width - 4 &&
    inner.y + inner.height - 1 <= height - 4 &&
    placed.every((other) => !overlapsWithGap(inner, other.inner, 3));

  const tryPlace = (
    size: { w: number; h: number },
    role: Chamber["role"],
    xRange: readonly [number, number],
    tries: number,
    score?: (inner: Rect) => number,
  ): boolean => {
    let best: Rect | null = null;
    let bestScore = -Infinity;
    for (let attempt = 0; attempt < tries; attempt++) {
      const spanX = Math.max(1, xRange[1] - xRange[0]);
      const inner: Rect = {
        x: odd(xRange[0] + Math.floor(rand() * spanX)),
        y: odd(3 + Math.floor(rand() * Math.max(1, height - 6 - size.h))),
        width: size.w,
        height: size.h,
      };
      if (!fits(inner)) continue;
      if (!score) {
        best = inner;
        break;
      }
      const value = score(inner);
      if (value > bestScore) {
        bestScore = value;
        best = inner;
      }
    }
    if (!best) return false;
    placed.push({ inner: best, role });
    return true;
  };

  // Start hugs the west side, the boss the east: the run reads left to right.
  if (!tryPlace(START_SIZE, "start", [3, Math.floor(width * 0.22)], 60)) return null;
  const start = placed[0]!.inner;
  if (
    !tryPlace(
      BOSS_SIZE,
      "boss",
      [Math.floor(width * 0.6), width - 4 - BOSS_SIZE.w],
      40,
      (inner) => Math.abs(inner.x - start.x) + Math.abs(inner.y - start.y),
    )
  ) {
    return null;
  }

  for (let index = 0; index < denCount; index++) {
    const size = DEN_SIZES[Math.floor(rand() * DEN_SIZES.length)]!;
    // Spread dens out: among a few candidates keep the one farthest from the rest.
    const ok = tryPlace(size, "den", [3, width - 4 - size.w], 24, (inner) =>
      Math.min(
        ...placed.map(
          (other) => Math.abs(inner.x - other.inner.x) + Math.abs(inner.y - other.inner.y),
        ),
      ),
    );
    if (!ok && !tryPlace({ w: 5, h: 5 }, "den", [3, width - 9], 200)) return null;
  }
  return placed;
}

function gridSize(denCount: number, attempt: number): { width: number; height: number } {
  const chambers = denCount + 2;
  // Each chamber needs its footprint plus maze around it.
  const area = chambers * 150 + 260 + attempt * 220;
  const width = Math.max(33, odd(Math.round(Math.sqrt(area * 1.45))));
  const height = Math.max(23, odd(Math.round(area / width)));
  return { width, height };
}

const isWalkable = (code: number | undefined): boolean =>
  code === TileCode.FLOOR ||
  code === TileCode.FLOOR_ALT ||
  code === TileCode.DOOR_OPEN ||
  code === TileCode.DOOR_LOCKED ||
  code === TileCode.STAIRS;

export function generateLabyrinthFloor(plan: FloorPlan, seed: number): FloorMap {
  if (plan.rooms.length === 0) {
    throw new Error("generateLabyrinthFloor: plan must contain at least one room");
  }

  const denPlans = plan.rooms.filter((room) => room.kind === "minions");
  const bossPlan =
    plan.rooms.find((room) => room.kind !== "minions") ?? plan.rooms[plan.rooms.length - 1]!;
  const hasMinions = denPlans.some((room) => room.monsterIds.length > 0);

  let rand = mulberry32(seed);
  let width = 0;
  let height = 0;
  let chambers: Chamber[] | null = null;
  for (let attempt = 0; attempt < 12 && !chambers; attempt++) {
    rand = mulberry32(seed + attempt * 7919);
    ({ width, height } = gridSize(denPlans.length, attempt));
    chambers = placeChambers(width, height, denPlans.length, rand);
  }
  if (!chambers) throw new Error("generateLabyrinthFloor: chambers do not fit");

  const tiles: number[][] = Array.from({ length: height }, () =>
    new Array<number>(width).fill(TileCode.WALL_TOP),
  );
  const inChamber = (x: number, y: number): boolean =>
    chambers!.some(
      ({ inner }) =>
        x >= inner.x - 1 &&
        x <= inner.x + inner.width &&
        y >= inner.y - 1 &&
        y <= inner.y + inner.height,
    );

  for (const { inner } of chambers) {
    for (let y = inner.y; y < inner.y + inner.height; y++) {
      for (let x = inner.x; x < inner.x + inner.width; x++) tiles[y]![x] = TileCode.FLOOR;
    }
  }

  // ── Maze over every free lattice cell (growing tree, mostly newest-first) ──
  const isFreeCell = (x: number, y: number): boolean =>
    x >= 1 && y >= 1 && x <= width - 2 && y <= height - 2 && !inChamber(x, y);
  const startInner = chambers[0]!.inner;
  const origin: Vec2 = { x: startInner.x - 2, y: startInner.y };
  tiles[origin.y]![origin.x] = TileCode.FLOOR;
  const active: Vec2[] = [origin];
  while (active.length > 0) {
    const pick = rand() < 0.84 ? active.length - 1 : Math.floor(rand() * active.length);
    const cell = active[pick]!;
    const options = DIRS.filter(([dx, dy]) => {
      const nx = cell.x + dx * 2;
      const ny = cell.y + dy * 2;
      return isFreeCell(nx, ny) && tiles[ny]![nx] === TileCode.WALL_TOP;
    });
    if (options.length === 0) {
      active.splice(pick, 1);
      continue;
    }
    const [dx, dy] = options[Math.floor(rand() * options.length)]!;
    tiles[cell.y + dy]![cell.x + dx] = TileCode.FLOOR;
    tiles[cell.y + dy * 2]![cell.x + dx * 2] = TileCode.FLOOR;
    active.push({ x: cell.x + dx * 2, y: cell.y + dy * 2 });
  }

  // ── Doors: one per chamber, on a wall tile that faces a maze cell ──────────
  const doorOf = new Map<Chamber, Vec2>();
  const doorCandidates = (inner: Rect): Vec2[] => {
    const list: Vec2[] = [];
    for (let x = inner.x; x < inner.x + inner.width; x += 2) {
      list.push({ x, y: inner.y - 1 }, { x, y: inner.y + inner.height });
    }
    for (let y = inner.y; y < inner.y + inner.height; y += 2) {
      list.push({ x: inner.x - 1, y }, { x: inner.x + inner.width, y });
    }
    return list.filter((door) =>
      DIRS.some(([dx, dy]) => {
        const ox = door.x + dx;
        const oy = door.y + dy;
        return !inChamber(ox, oy) && tiles[oy]?.[ox] === TileCode.FLOOR;
      }),
    );
  };
  for (const chamber of chambers) {
    const candidates = doorCandidates(chamber.inner);
    if (candidates.length === 0) throw new Error("generateLabyrinthFloor: chamber has no door");
    let door = candidates[Math.floor(rand() * candidates.length)]!;
    if (chamber.role === "start") {
      door = candidates.find((c) => c.x === origin.x + 1 && c.y === origin.y) ?? door;
    }
    doorOf.set(chamber, door);
    tiles[door.y]![door.x] = TileCode.DOOR_OPEN;
  }

  // ── Trim dead ends, keeping some short ones as loot nooks ──────────────────
  const corridor = (x: number, y: number): boolean =>
    tiles[y]?.[x] === TileCode.FLOOR && !inChamber(x, y);
  const exits = (x: number, y: number): Vec2[] =>
    DIRS.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter((n) => isWalkable(tiles[n.y]?.[n.x]));

  const besideDoor = (x: number, y: number): boolean =>
    DIRS.some(([dx, dy]) => tiles[y + dy]?.[x + dx] === TileCode.DOOR_OPEN);

  const deadEnds: Vec2[] = [];
  const tips: Vec2[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (corridor(x, y) && exits(x, y).length === 1) tips.push({ x, y });
    }
  }
  for (const tip of tips) {
    // Walk the branch back to its junction.
    const branch: Vec2[] = [];
    let current: Vec2 | null = tip;
    while (
      current &&
      corridor(current.x, current.y) &&
      exits(current.x, current.y).length <= 1 &&
      !besideDoor(current.x, current.y) // the tile outside a door is never trimmed
    ) {
      branch.push(current);
      tiles[current.y]![current.x] = TileCode.VOID; // temporary mark
      const next: Vec2[] = exits(current.x, current.y);
      current = next[0] ?? null;
    }
    const keep = rand() >= DEAD_END_TRIM;
    const kept = keep ? branch.slice(Math.max(0, branch.length - DEAD_END_MAX_LEN)) : [];
    for (const tile of branch) {
      tiles[tile.y]![tile.x] = kept.includes(tile) ? TileCode.FLOOR : TileCode.WALL_TOP;
    }
    if (kept.length > 0) deadEnds.push(kept[0]!);
  }

  // ── Loops: knock through a few walls between two corridor runs ─────────────
  const loopSpots: Vec2[] = [];
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (tiles[y]![x] !== TileCode.WALL_TOP || inChamber(x, y)) continue;
      const horizontal = corridor(x - 1, y) && corridor(x + 1, y) && !corridor(x, y - 1) && !corridor(x, y + 1);
      const vertical = corridor(x, y - 1) && corridor(x, y + 1) && !corridor(x - 1, y) && !corridor(x + 1, y);
      if (horizontal || vertical) loopSpots.push({ x, y });
    }
  }
  const loops = Math.min(loopSpots.length, Math.max(2, Math.round((width * height) / 260)));
  for (let index = 0; index < loops; index++) {
    const pick = Math.floor(rand() * loopSpots.length);
    const spot = loopSpots.splice(pick, 1)[0]!;
    tiles[spot.y]![spot.x] = TileCode.FLOOR;
  }

  // ── Order dens by walking distance from the start: near = first in plan ───
  const startCentre: Vec2 = {
    x: startInner.x + Math.floor(startInner.width / 2),
    y: startInner.y + Math.floor(startInner.height / 2),
  };
  const distance = new Map<string, number>([[`${startCentre.x},${startCentre.y}`, 0]]);
  const queue: Vec2[] = [startCentre];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    const base = distance.get(`${cell.x},${cell.y}`)!;
    for (const next of exits(cell.x, cell.y)) {
      const key = `${next.x},${next.y}`;
      if (distance.has(key)) continue;
      distance.set(key, base + 1);
      queue.push(next);
    }
  }
  const doorDistance = (chamber: Chamber): number => {
    const door = doorOf.get(chamber)!;
    return distance.get(`${door.x},${door.y}`) ?? Number.MAX_SAFE_INTEGER;
  };
  const dens = chambers.filter((chamber) => chamber.role === "den").sort((a, b) => doorDistance(a) - doorDistance(b));
  const bossChamber = chambers.find((chamber) => chamber.role === "boss")!;

  // ── Rooms ──────────────────────────────────────────────────────────────────
  const outerOf = (inner: Rect): Rect => ({
    x: inner.x - 1,
    y: inner.y - 1,
    width: inner.width + 2,
    height: inner.height + 2,
  });
  const centreOf = (inner: Rect): Vec2 => ({
    x: inner.x + Math.floor(inner.width / 2),
    y: inner.y + Math.floor(inner.height / 2),
  });

  const rooms: Room[] = [];
  const ordered: Array<{ chamber: Chamber; planned: FloorPlan["rooms"][number] }> = [
    ...denPlans.map((planned, index) => ({ chamber: dens[index]!, planned })),
    { chamber: bossChamber, planned: bossPlan },
  ];

  let stairs: Vec2 = { x: 0, y: 0 };
  for (const { chamber, planned } of ordered) {
    const isBoss = chamber === bossChamber;
    const { inner } = chamber;
    const door = doorOf.get(chamber)!;
    const spawn = centreOf(inner);
    const hasMonster = isBoss || planned.monsterIds.length > 0;

    if (isBoss) {
      // Stairs sit in the corner farthest from the gate.
      const corners: Vec2[] = [
        { x: inner.x, y: inner.y },
        { x: inner.x + inner.width - 1, y: inner.y },
        { x: inner.x, y: inner.y + inner.height - 1 },
        { x: inner.x + inner.width - 1, y: inner.y + inner.height - 1 },
      ];
      stairs = corners.reduce((best, corner) =>
        Math.abs(corner.x - door.x) + Math.abs(corner.y - door.y) >
        Math.abs(best.x - door.x) + Math.abs(best.y - door.y)
          ? corner
          : best,
      );
      if (hasMinions) tiles[door.y]![door.x] = TileCode.DOOR_LOCKED;
    }

    rooms.push({
      id: `f${plan.floorOrder}-r${rooms.length}`,
      findingId: planned.monsterIds[0] ?? null,
      findingIds: planned.monsterIds,
      rect: outerOf(inner),
      isBoss,
      monsterSpawn: hasMonster ? spawn : { x: -999, y: -999 },
      monsterSpawns: hasMonster ? [spawn] : [],
      entranceDoor: door,
      kind: planned.kind,
      bossSlug: plan.bossSlug,
    });
  }

  // ── Dressing ───────────────────────────────────────────────────────────────
  const reserved = new Set<string>([`${stairs.x},${stairs.y}`]);
  for (const room of rooms) reserved.add(`${room.monsterSpawn.x},${room.monsterSpawn.y}`);
  const nearDoor = (x: number, y: number, door: Vec2): boolean =>
    Math.abs(x - door.x) + Math.abs(y - door.y) <= 2;

  for (const chamber of chambers) {
    const { inner } = chamber;
    const door = doorOf.get(chamber)!;
    const isBoss = chamber.role === "boss";
    // Torches / banners along the north wall.
    for (let x = inner.x + 1; x < inner.x + inner.width - 1; x += isBoss ? 3 : 4) {
      if (tiles[inner.y - 1]![x] === TileCode.WALL_TOP) {
        tiles[inner.y - 1]![x] = isBoss ? TileCode.BANNER_RED : TileCode.WALL_DECOR;
      }
    }
    if (chamber.role === "start") continue;
    // Crates in the south corners, never where they could box in the door.
    for (const x of [inner.x, inner.x + inner.width - 1]) {
      const y = inner.y + inner.height - 1;
      if (reserved.has(`${x},${y}`) || nearDoor(x, y, door)) continue;
      tiles[y]![x] = TileCode.PROP;
    }
  }

  tiles[stairs.y]![stairs.x] = TileCode.STAIRS;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const code = tiles[y]![x]!;
      if (code === TileCode.FLOOR) {
        if (!reserved.has(`${x},${y}`) && rand() < FLOOR_ALT_CHANCE) tiles[y]![x] = TileCode.FLOOR_ALT;
        continue;
      }
      if (code !== TileCode.WALL_TOP) continue;
      // Rock nobody can see becomes void; a wall above floor shows its face.
      let touchesFloor = false;
      for (let dy = -1; dy <= 1 && !touchesFloor; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (isWalkable(tiles[y + dy]?.[x + dx]) || tiles[y + dy]?.[x + dx] === TileCode.PROP) {
            touchesFloor = true;
            break;
          }
        }
      }
      if (!touchesFloor) tiles[y]![x] = TileCode.VOID;
    }
  }
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const below = tiles[y + 1]![x];
      if (
        tiles[y]![x] === TileCode.WALL_TOP &&
        (below === TileCode.FLOOR || below === TileCode.FLOOR_ALT || below === TileCode.PROP || below === TileCode.STAIRS)
      ) {
        tiles[y]![x] = TileCode.WALL_FACE;
      }
    }
  }

  return {
    floorOrder: plan.floorOrder,
    tiles,
    rooms,
    playerSpawn: startCentre,
    stairs,
    width,
    height,
    dimension: plan.dimension,
    bossSlug: plan.bossSlug,
    deadEnds: deadEnds.filter((tile) => isWalkable(tiles[tile.y]?.[tile.x])),
  };
}
