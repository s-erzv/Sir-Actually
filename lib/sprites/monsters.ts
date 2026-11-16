/**
 * Animated monster and boss art (Ninja Adventure by Pixel-Boy & AAA, CC0).
 *
 * Humanoid minions reuse the 64x112 character sheet layout: 16x16 frames,
 * 4 columns (down, up, left, right), 7 rows (walk 0-3, attack 4, hurt 5,
 * dead 6). Bosses are standalone sheets whose frame size is the sheet height.
 */

export interface MinionSheet {
  slug: string;
  path: string;
  face: string;
  portrait: string;
}

export interface BossSheet {
  slug: string;
  idle: string;
  hit: string;
  walk?: string;
  face: string;
  portrait: string;
  frameWidth: number;
  frameHeight: number;
  idleFrames: number;
  hitFrames: number;
  walkFrames: number;
}

const MINION_ART: Record<string, { art: string; path: string }> = {
  varkul: { art: "varkul", path: "/assets/ninja-adventure/monsters/varkul.png" },
  nethrix: { art: "nethrix", path: "/assets/ninja-adventure/monsters/nethrix.png" },
  zorveth: { art: "zorveth", path: "/assets/ninja-adventure/monsters/zorveth.png" },
  thalgrim: { art: "thalgrim", path: "/assets/ninja-adventure/monsters/thalgrim.png" },
  xyrath: { art: "xyrath", path: "/assets/ninja-adventure/monsters/xyrath.png" },
  othrak: { art: "othrak", path: "/assets/ninja-adventure/monsters/othrak.png" },
  velmora: { art: "velmora", path: "/assets/ninja-adventure/monsters/velmora.png" },
  grivak: { art: "grivak", path: "/assets/ninja-adventure/monsters/grivak.png" },
};

export const MINION_SHEETS: Record<string, MinionSheet> = Object.fromEntries(
  Object.entries(MINION_ART).map(([slug, entry]) => [
    slug,
    {
      slug,
      path: entry.path,
      face: `/assets/ninja-adventure/monsters/faces/${slug}.png`,
      portrait: `/assets/ninja-adventure/portraits/minion-${slug}.png`,
    },
  ]),
);

const BOSS_ART: Record<
  string,
  {
    source: string;
    frameWidth: number;
    frameHeight: number;
    idleFrames: number;
    hitFrames: number;
    walkFrames: number;
    walk?: boolean;
  }
> = {
  veylith: { source: "veylith", frameWidth: 50, frameHeight: 50, idleFrames: 5, hitFrames: 3, walkFrames: 6, walk: true },
  draeven: { source: "draeven", frameWidth: 82, frameHeight: 82, idleFrames: 6, hitFrames: 8, walkFrames: 10, walk: true },
  kryvax: { source: "kryvax", frameWidth: 62, frameHeight: 62, idleFrames: 6, hitFrames: 4, walkFrames: 12, walk: true },
  morvane: { source: "morvane", frameWidth: 50, frameHeight: 50, idleFrames: 5, hitFrames: 3, walkFrames: 0 },
  nyxara: { source: "nyxara", frameWidth: 50, frameHeight: 50, idleFrames: 5, hitFrames: 3, walkFrames: 0 },
  eldravos: { source: "eldravos", frameWidth: 48, frameHeight: 48, idleFrames: 12, hitFrames: 8, walkFrames: 12, walk: true },
};

export const BOSS_SHEETS: Record<string, BossSheet> = Object.fromEntries(
  Object.entries(BOSS_ART).map(([slug, entry]) => [
    slug,
    {
      slug,
      idle: `/assets/ninja-adventure/bosses/${slug}-idle.png`,
      hit: `/assets/ninja-adventure/bosses/${slug}-hit.png`,
      ...(entry.walk ? { walk: `/assets/ninja-adventure/bosses/${slug}-walk.png` } : {}),
      face: `/assets/ninja-adventure/bosses/faces/${slug}.png`,
      portrait: `/assets/ninja-adventure/portraits/${slug}.png`,
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      idleFrames: entry.idleFrames,
      hitFrames: entry.hitFrames,
      walkFrames: entry.walkFrames,
    },
  ]),
);

export function minionSheetFor(slug: string): MinionSheet | undefined {
  return MINION_SHEETS[slug];
}

export function bossSheetFor(slug: string | undefined): BossSheet | undefined {
  if (!slug) return undefined;
  return BOSS_SHEETS[slug.toLowerCase()];
}

export function minionArtKey(slug: string): string {
  return `minion-sheet-${slug}`;
}

export function bossIdleKey(slug: string): string {
  return `boss-${slug}-idle`;
}

export function bossHitKey(slug: string): string {
  return `boss-${slug}-hit`;
}

export function bossWalkKey(slug: string): string {
  return `boss-${slug}-walk`;
}

export function minionWalkAnim(slug: string, facing: string): string {
  return `${slug}-minion-walk-${facing}`;
}

export function bossIdleAnim(slug: string): string {
  return `${slug}-boss-idle`;
}

export function bossHitAnim(slug: string): string {
  return `${slug}-boss-hit`;
}

/** Portrait URL for an encounter slug (`minion-varkul`, `veylith`, ...). */
export function monsterPortraitFor(slug: string | undefined, isBoss: boolean): string | undefined {
  if (!slug) return undefined;
  const clean = slug.replace(/^minion-/, "").toLowerCase();
  if (isBoss) return BOSS_SHEETS[clean]?.portrait;
  return MINION_SHEETS[clean]?.portrait;
}
