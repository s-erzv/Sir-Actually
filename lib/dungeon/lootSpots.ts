import { TileCode } from "@/game/map/tiles";
import type { FloorMap } from "@/lib/domain/types";
import { lootKindForKey } from "./loot";

const LOOT_FRAMES = [669, 670, 738, 739, 608, 621, 1022];

export interface LootSpot {
  key: string;
  x: number;
  y: number;
  frame: number;
  kind: "points" | "potion";
}

/**
 * Deterministic loot placement. Shared by Phaser rendering and the server's
 * loot validation so a client cannot invent arbitrary loot keys.
 */
export function lootSpotsForFloor(map: FloorMap): LootSpot[] {
  const taken = new Set<string>();
  for (const room of map.rooms) {
    for (const spawn of room.monsterSpawns?.length ? room.monsterSpawns : [room.monsterSpawn]) {
      taken.add(`${spawn.x},${spawn.y}`);
    }
  }

  let seed = map.rooms.length * 7919 + map.width;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const spots: LootSpot[] = [];

  for (const room of map.rooms) {
    const { x, y, width, height } = room.rect;
    const count = room.isBoss ? 4 : 2 + Math.floor(rand() * 3);
    for (let index = 0, tries = 0; index < count && tries < 30; tries += 1) {
      const tx = x + 1 + Math.floor(rand() * Math.max(1, width - 2));
      const ty = y + 1 + Math.floor(rand() * Math.max(1, height - 2));
      if (taken.has(`${tx},${ty}`)) continue;
      if (map.tiles[ty]?.[tx] !== TileCode.FLOOR) continue;
      const nearDoor =
        room.entranceDoor &&
        Math.abs(room.entranceDoor.x - tx) + Math.abs(room.entranceDoor.y - ty) < 3;
      if (nearDoor) continue;
      taken.add(`${tx},${ty}`);
      index += 1;
      spots.push({
        key: `${room.id}:${tx},${ty}`,
        x: tx,
        y: ty,
        frame: LOOT_FRAMES[Math.floor(rand() * LOOT_FRAMES.length)]!,
        kind: lootKindForKey(`${room.id}:${tx},${ty}`),
      });
    }
  }

  // Every surviving dead end pays off: exploring the maze is never wasted.
  for (const tip of map.deadEnds ?? []) {
    if (taken.has(`${tip.x},${tip.y}`)) continue;
    const code = map.tiles[tip.y]?.[tip.x];
    if (code !== TileCode.FLOOR && code !== TileCode.FLOOR_ALT) continue;
    taken.add(`${tip.x},${tip.y}`);
    spots.push({
      key: `f${map.floorOrder}-nook:${tip.x},${tip.y}`,
      x: tip.x,
      y: tip.y,
      frame: LOOT_FRAMES[Math.floor(rand() * LOOT_FRAMES.length)]!,
      kind: lootKindForKey(`f${map.floorOrder}-nook:${tip.x},${tip.y}`),
    });
  }

  return spots;
}
