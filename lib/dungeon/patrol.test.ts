import { describe, expect, it } from "vitest";
import { patrolCandidates } from "./patrol";
import { TileCode } from "@/game/map/tiles";

function grid(size = 10, fill: TileCode = TileCode.FLOOR): number[][] {
  return Array.from({ length: size }, () => Array<number>(size).fill(fill));
}

describe("patrolCandidates", () => {
  it("returns walkable one-tile neighbours inside the room", () => {
    const options = patrolCandidates({
      current: { x: 4, y: 4 },
      home: { x: 4, y: 4 },
      roomRect: { x: 1, y: 1, width: 8, height: 8 },
      playerTile: { x: 9, y: 9 },
      occupied: new Set<string>(),
      tiles: grid(),
    });
    expect(options).toHaveLength(4);
  });

  it("excludes walls, occupied tiles, and the player tile", () => {
    const tiles = grid();
    tiles[3][4] = TileCode.WALL_TOP;
    const options = patrolCandidates({
      current: { x: 4, y: 4 },
      home: { x: 4, y: 4 },
      roomRect: { x: 1, y: 1, width: 8, height: 8 },
      playerTile: { x: 5, y: 4 },
      occupied: new Set(["4,5"]),
      tiles,
    });
    expect(options).toEqual([{ x: 3, y: 4 }]);
  });

  it("strays no more than two tiles from home", () => {
    const options = patrolCandidates({
      current: { x: 7, y: 7 },
      home: { x: 4, y: 4 },
      roomRect: { x: 1, y: 1, width: 9, height: 9 },
      playerTile: { x: 0, y: 0 },
      occupied: new Set<string>(),
      tiles: grid(12),
    });
    for (const option of options) {
      expect(Math.abs(option.x - 4)).toBeLessThanOrEqual(2);
      expect(Math.abs(option.y - 4)).toBeLessThanOrEqual(2);
    }
  });
});
