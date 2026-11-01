/**
 * tiles.ts — Logical tile codes for the floor map generator.
 *
 * IMPORTANT: This file contains LOGICAL codes only (what a tile IS).
 * The actual sprite frame indices are in tileFrames.ts (what a tile LOOKS LIKE).
 * generateFloor.ts imports from this file only.
 * DungeonScene.ts imports from tileFrames.ts only.
 *
 * Spritesheet facts (confirmed from Tilesheet.txt + sampleSheet.tsx):
 *   File    : Tilemap/tilemap.png  (203 × 186 px)
 *   Tile    : 16 × 16 px
 *   Spacing : 1 px between tiles
 *   Layout  : 12 columns × 11 rows = 132 frames (0-based, row-major)
 */

export const TILE_SIZE = 16;
export const TILE_SPACING = 1;
export const SHEET_COLS = 12;

export enum TileCode {
  VOID        = 0,   // not drawn — area outside rooms (transparent → bg colour)
  WALL_TOP    = 1,   // solid wall (top/ceiling view)
  FLOOR       = 2,   // walkable stone floor
  WALL_FACE   = 3,   // wall tile facing south onto floor (shows "front")
  DOOR_LOCKED = 4,   // iron gate — blocks movement
  DOOR_OPEN   = 5,   // gate opened (resolved encounter) — passable
  STAIRS      = 6,   // stairs down (drawn on top of FLOOR in decor layer)
  WALL_DECOR  = 7,   // decorative on north WALL_FACE (replaces torches)
  BANNER_RED  = 8,   // red banner on boss room north wall
  FLOOR_ALT   = 9,   // cracked/variant floor (~6% of floor tiles)
  PROP        = 10,  // barrel/chest in room corners (drawn above FLOOR)
}

// ---------------------------------------------------------------------------
// Collision table — which TileCodes block movement
// ---------------------------------------------------------------------------

export const SOLID_TILES: ReadonlySet<TileCode> = new Set([
  TileCode.WALL_TOP,
  TileCode.WALL_FACE,
  TileCode.WALL_DECOR,
  TileCode.BANNER_RED,
  TileCode.DOOR_LOCKED,
  TileCode.PROP,
]);

export function isSolid(code: TileCode): boolean {
  return SOLID_TILES.has(code);
}

// ---------------------------------------------------------------------------
// Layer assignment — which layer each TileCode goes into
// ---------------------------------------------------------------------------

/** Ground layer: the base floor surface drawn first. */
export const GROUND_LAYER_TILES: ReadonlySet<TileCode> = new Set([
  TileCode.FLOOR,
  TileCode.FLOOR_ALT,
]);

/** Wall layer: drawn above ground. */
export const WALL_LAYER_TILES: ReadonlySet<TileCode> = new Set([
  TileCode.WALL_TOP,
  TileCode.WALL_FACE,
]);

/** Decor layer: drawn above walls (doors, stairs, props, banners, decor). */
export const DECOR_LAYER_TILES: ReadonlySet<TileCode> = new Set([
  TileCode.DOOR_LOCKED,
  TileCode.DOOR_OPEN,
  TileCode.STAIRS,
  TileCode.WALL_DECOR,
  TileCode.BANNER_RED,
  TileCode.PROP,
]);
