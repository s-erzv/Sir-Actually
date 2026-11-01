/**
 * tileFrames.ts — Maps logical tile/sprite names to frame indices in tilemap.png.
 *
 * STATUS: Dipetakan dari atlas oleh Maou+Claude, verifikasi visual di preview.
 *
 * Frame index = row * 12 + col  (0-based, row-major, 12 columns per row)
 * Spritesheet: tilemap.png, 16×16 px tiles, 1 px spacing, 12 cols × 11 rows = 132 frames
 *
 * Design notes (from Maou, 30 Oct 2026):
 * - No dedicated torch/torch_red tiles exist in this sheet.
 *   Use WALL_DECOR on north wall every 4 tiles; BANNER_RED in boss rooms.
 * - DOOR_LOCKED = iron gate; when opened, tween gate up then swap tile to FLOOR.
 * - STAIRS overlaid on top of FLOOR (drawn in decor layer above ground).
 * - All transparent sprites (props, stairs, entities) go in the layer above FLOOR.
 */

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

/** Stone floor — primary walkable surface. Dark grey cobblestone. */
export const FRAME_FLOOR = 0;

/** Cracked/alternate floor tiles (~6% of floor area). */
export const FRAME_FLOOR_ALT: readonly number[] = [12, 24];

/** Desert/sand floor tiles (used in Ghost library scene). */
export const FRAME_FLOOR_SAND: readonly number[] = [48, 49, 51];

/**
 * Wall face tile — the wall row immediately above a floor row (shows "front" of wall).
 * Also used as WALL_TOP (same tile; no separate top exists in this sheet).
 */
export const FRAME_WALL_FACE = 40;

/** Same as WALL_FACE — no separate top tile in this sheet. */
export const FRAME_WALL_TOP = 40;

// ---------------------------------------------------------------------------
// Doors & Navigation
// ---------------------------------------------------------------------------

/** Iron gate (locked door). Frame 77. Alt considered: 45. */
export const FRAME_DOOR_LOCKED = 77;

/**
 * Open door state. When door is unlocked, tile becomes plain floor (FRAME_FLOOR).
 * No dedicated open-door frame needed; the gate tween removes it.
 * Keeping this alias for code clarity.
 */
export const FRAME_DOOR_OPEN = FRAME_FLOOR;

/**
 * Stairs tile — drawn on top of floor in decor layer.
 * Frame 56. Alt considered: 10.
 */
export const FRAME_STAIRS = 56;

// ---------------------------------------------------------------------------
// Decorations
// ---------------------------------------------------------------------------

/**
 * Wall decoration tiles — placed on WALL_FACE tiles along north wall.
 * Replaces torches (no torch tile in this sheet).
 * Frames 28, 7, 19.
 */
export const FRAME_WALL_DECOR: readonly number[] = [28, 7, 19];

/**
 * Red banner/flag — used in boss room north wall instead of WALL_DECOR.
 * Frame 29.
 */
export const FRAME_BANNER_RED = 29;

/**
 * Prop tiles — barrels/crates/chests placed in room corners.
 * Frames 82, 89, 63.
 */
export const FRAME_PROP: readonly number[] = [82, 89, 63];

/** Grave/tombstone decoration. Frame 65. */
export const FRAME_GRAVE = 65;

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

/**
 * Player character sprite. Frame 84.
 * Characters in this sheet are one 16×16 tile.
 */
export const FRAME_PLAYER = 87;

/**
 * In-game sprites for the five playable characters. These are actual frames
 * from the Kenney atlas, not palette swaps.
 *   84 wizard · 85 traveller · 87 knight · 96 helm knight · 97 blue knight
 */
export const PLAYER_FRAMES_BY_CHARACTER: Record<string, number> = {
  arka: 87,
  mira: 84,
  sena: 96,
  kiran: 85,
  vara: 97,
};

export function playerFrameFor(characterSlug?: string | null): number {
  if (!characterSlug) return FRAME_PLAYER;
  return PLAYER_FRAMES_BY_CHARACTER[characterSlug] ?? FRAME_PLAYER;
}

/**
 * Minion enemy sprites (Dungeon Creatures: Varkul, Nethrix, Zorveth, Thalgrim, Xyrath, Othrak, Velmora, Grivak).
 * MINION_1=120 (Gap Hunter floor), MINION_2=122 (Aligner), MINION_3=108 (Methodologist).
 */
export const FRAME_MINION: readonly number[] = [120, 122, 108];

// ---------------------------------------------------------------------------
// Bosses / Dungeon Lords & Sovereign
// ---------------------------------------------------------------------------

/** Floor 1 Boss — Veylith (The Void Stalker / Gap Hunter). Frame 112. */
export const FRAME_BOSS_VEYLITH = 112;
export const FRAME_BOSS_GAP_HUNTER = FRAME_BOSS_VEYLITH;

/** Floor 2 Boss — Draeven (The Dreadfang / Aligner). Frame 97. */
export const FRAME_BOSS_DRAEVEN = 97;
export const FRAME_BOSS_ALIGNER = FRAME_BOSS_DRAEVEN;

/** Floor 3 Boss — Kryvax (The Twisted Brood / Methodologist). Frame 111. */
export const FRAME_BOSS_KRYVAX = 111;
export const FRAME_BOSS_METHODOLOGIST = FRAME_BOSS_KRYVAX;

/** Floor 4 Boss — Morvane (The Gravebound / Auditor). Frame 86. */
export const FRAME_BOSS_MORVANE = 86;
export const FRAME_BOSS_AUDITOR = FRAME_BOSS_MORVANE;

/** Floor 5 Boss — Nyxara (The Forgotten Keeper / Ghost Library). Frame 121. */
export const FRAME_BOSS_NYXARA = 121;
export const FRAME_BOSS_GHOST = FRAME_BOSS_NYXARA;

/** Final Boss — Eldravos (The Ancient Sovereign / Sir, Actually). Frame 100. */
export const FRAME_BOSS_ELDRAVOS = 100;
export const FRAME_BOSS_SIR_ACTUALLY = FRAME_BOSS_ELDRAVOS;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** All boss frames indexed by floor order (1–4 = dungeon floors, 5 = ghost, 6 = finale). */
export const BOSS_FRAMES_BY_FLOOR: Record<number, number> = {
  1: FRAME_BOSS_VEYLITH,
  2: FRAME_BOSS_DRAEVEN,
  3: FRAME_BOSS_KRYVAX,
  4: FRAME_BOSS_MORVANE,
  5: FRAME_BOSS_NYXARA,
  6: FRAME_BOSS_ELDRAVOS,
};

export const BOSS_FRAMES_BY_SLUG: Record<string, number> = {
  veylith: FRAME_BOSS_VEYLITH,
  draeven: FRAME_BOSS_DRAEVEN,
  kryvax: FRAME_BOSS_KRYVAX,
  morvane: FRAME_BOSS_MORVANE,
  nyxara: FRAME_BOSS_NYXARA,
  eldravos: FRAME_BOSS_ELDRAVOS,
};

export function bossFrame(slug: string | undefined, floorOrder: number): number {
  if (slug && BOSS_FRAMES_BY_SLUG[slug]) return BOSS_FRAMES_BY_SLUG[slug]!;
  return BOSS_FRAMES_BY_FLOOR[floorOrder] ?? BOSS_FRAMES_BY_FLOOR[1]!;
}

/** Minion frame for a given floor (1–4). Cycles through FRAME_MINION array. */
export function minionFrame(floor: number): number {
  return FRAME_MINION[(floor - 1) % FRAME_MINION.length] ?? FRAME_MINION[0];
}

/** Pick a random floor-alt frame seeded by position (deterministic). */
export function floorAltFrame(seed: number): number {
  return FRAME_FLOOR_ALT[seed % FRAME_FLOOR_ALT.length] ?? FRAME_FLOOR_ALT[0];
}

/** Pick a wall decor frame deterministically by x position. */
export function wallDecorFrame(tileX: number, isBoss: boolean): number {
  if (isBoss) return FRAME_BANNER_RED;
  return FRAME_WALL_DECOR[tileX % FRAME_WALL_DECOR.length] ?? FRAME_WALL_DECOR[0];
}
