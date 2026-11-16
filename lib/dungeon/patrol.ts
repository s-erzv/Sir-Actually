import type { Rect, Vec2 } from "@/lib/domain/types";
import { TileCode, isSolid } from "@/game/map/tiles";

export interface PatrolInput {
  current: Vec2;
  home: Vec2;
  roomRect: Rect;
  playerTile: Vec2;
  occupied: ReadonlySet<string>;
  tiles: readonly (readonly number[])[];
}

/**
 * One-tile patrol options: inside the room, near home, walkable, unoccupied,
 * and not on the player.
 */
export function patrolCandidates(input: PatrolInput): Vec2[] {
  const { current, home, roomRect, playerTile, occupied, tiles } = input;
  const minX = Math.max(roomRect.x + 1, home.x - 2);
  const maxX = Math.min(roomRect.x + roomRect.width - 2, home.x + 2);
  const minY = Math.max(roomRect.y + 1, home.y - 2);
  const maxY = Math.min(roomRect.y + roomRect.height - 2, home.y + 2);

  return ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
    .map(([dx, dy]) => ({ x: current.x + dx, y: current.y + dy }))
    .filter(({ x, y }) => {
      if (x < minX || x > maxX || y < minY || y > maxY) return false;
      if (x === playerTile.x && y === playerTile.y) return false;
      if (occupied.has(`${x},${y}`)) return false;
      const code = (tiles[y]?.[x] ?? TileCode.VOID) as TileCode;
      return !isSolid(code) && code !== TileCode.VOID && code !== TileCode.PROP;
    });
}
