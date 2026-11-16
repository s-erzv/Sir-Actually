/**
 * Animated character sheets (Ninja Adventure by Pixel-Boy & AAA, CC0).
 *
 * Every sheet is 64x112: 16x16 frames, 4 columns (down, up, left, right) and
 * 7 rows (0-3 walk cycle, row 0 doubles as idle, row 4 attack).
 *
 * A character without a sheet falls back to its vector art, so adding a
 * character is one line here plus the PNG in public/assets/ninja-adventure.
 */

export const SHEET_FRAME = 16;
export const SHEET_COLS = 4;

export type Facing = "down" | "up" | "left" | "right";
export const FACING_COLUMN: Record<Facing, number> = { down: 0, up: 1, left: 2, right: 3 };

const WALK_ROWS = [0, 1, 2, 3] as const;
const ATTACK_ROW = 4;

export const CHARACTER_SHEETS: Record<string, string> = {
  arka: "/assets/ninja-adventure/characters/arka.png",
  mira: "/assets/ninja-adventure/characters/mira.png",
  sena: "/assets/ninja-adventure/characters/sena.png",
  kiran: "/assets/ninja-adventure/characters/kiran.png",
  vara: "/assets/ninja-adventure/characters/vara.png",
};

/** 38x38 portrait of each character, for the loadout and dialogue UI. */
export const CHARACTER_FACES: Record<string, string> = {
  arka: "/assets/ninja-adventure/faces/arka.png",
  mira: "/assets/ninja-adventure/faces/mira.png",
  sena: "/assets/ninja-adventure/faces/sena.png",
  kiran: "/assets/ninja-adventure/faces/kiran.png",
  vara: "/assets/ninja-adventure/faces/vara.png",
};

export const sheetKey = (slug: string): string => `sheet-${slug}`;
export const walkAnimKey = (slug: string, facing: Facing): string => `${slug}-walk-${facing}`;

export function walkFrames(facing: Facing): number[] {
  return WALK_ROWS.map((row) => row * SHEET_COLS + FACING_COLUMN[facing]);
}

export function idleFrame(facing: Facing): number {
  return FACING_COLUMN[facing];
}

export function attackFrame(facing: Facing): number {
  return ATTACK_ROW * SHEET_COLS + FACING_COLUMN[facing];
}
