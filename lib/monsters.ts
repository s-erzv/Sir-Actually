/**
 * Canonical Monster Roster & Lore for Sir, Actually.
 *
 * Universe: Dark Fantasy Academia
 *
 * Hierarchy:
 * # ELDRAVOS — THE ANCIENT SOVEREIGN (Final Boss)
 *
 * The Four Dungeon Lords:
 *   1. Veylith — The Void Stalker (Floor 1 / Gap Hunter)
 *   2. Draeven — The Dreadfang (Floor 2 / The Aligner)
 *   3. Kryvax — The Twisted Brood (Floor 3 / Methodologist)
 *   4. Morvane — The Gravebound (Floor 4 / The Auditor)
 *
 * The Forgotten Keeper:
 *   5. Nyxara — The Forgotten Keeper (Floor 5 / Ghost Library)
 *
 * Dungeon Creatures (Minions):
 *   Varkul, Nethrix, Zorveth, Thalgrim, Xyrath, Othrak, Velmora, Grivak
 */

export interface BossInfo {
  slug: string;
  name: string;
  title: string;
  floorOrder: number;
  domain: string;
  dimension: string;
  line: string;
  lore: string;
  danger: number;
  spriteKey: string;
  tone: string;
}

export interface MinionInfo {
  slug: string;
  name: string;
  character: string;
  lore: string;
}

export const BOSS_ROSTER: Record<string, BossInfo> = {
  veylith: {
    slug: "veylith",
    name: "Veylith",
    title: "The Void Stalker",
    floorOrder: 1,
    domain: "GAP HUNTER",
    dimension: "gap",
    line: "Klaim gap tanpa dukungan referensi.",
    lore: "Predator dari kegelapan yang memburu sesuatu yang hilang.",
    danger: 2,
    spriteKey: "boss-gap",
    tone: "text-ember",
  },
  draeven: {
    slug: "draeven",
    name: "Draeven",
    title: "The Dreadfang",
    floorOrder: 2,
    domain: "THE ALIGNER",
    dimension: "align",
    line: "Masalah, tujuan, dan RQ tidak nyambung.",
    lore: "Binatang buas yang memiliki dua kepala dengan kehendak berbeda.",
    danger: 2,
    spriteKey: "boss-align",
    tone: "text-mana",
  },
  kryvax: {
    slug: "kryvax",
    name: "Kryvax",
    title: "The Twisted Brood",
    floorOrder: 3,
    domain: "METHODOLOGIST",
    dimension: "method",
    line: "Metode tidak menjawab pertanyaan penelitian.",
    lore: "Makhluk hasil mutasi yang terus berevolusi melalui eksperimen gagal.",
    danger: 3,
    spriteKey: "boss-method",
    tone: "text-moss",
  },
  morvane: {
    slug: "morvane",
    name: "Morvane",
    title: "The Gravebound",
    floorOrder: 4,
    domain: "THE AUDITOR",
    dimension: "audit",
    line: "Kesimpulan melampaui data yang ada.",
    lore: "Roh ksatria kuno yang menghakimi siapa pun yang memasuki wilayahnya.",
    danger: 3,
    spriteKey: "boss-audit",
    tone: "text-gold",
  },
  nyxara: {
    slug: "nyxara",
    name: "Nyxara",
    title: "The Forgotten Keeper",
    floorOrder: 5,
    domain: "GHOST LIBRARY",
    dimension: "ghost",
    line: "Sitasi yang tidak ditemukan atau tidak cocok.",
    lore: "Penjaga perpustakaan terkutuk yang menyimpan ingatan dan kitab palsu.",
    danger: 2,
    spriteKey: "boss-ghost",
    tone: "text-blood",
  },
  eldravos: {
    slug: "eldravos",
    name: "Eldravos",
    title: "The Ancient Sovereign",
    floorOrder: 6,
    domain: "FINAL BOSS",
    dimension: "final",
    line: "Boss terakhir. Semua celah diuji sekaligus.",
    lore: "Penguasa tertinggi dungeon. Entitas kuno yang menguji seluruh perjalanan pemain.",
    danger: 3,
    spriteKey: "boss-sir",
    tone: "text-bone",
  },
};

export const MINION_ROSTER: readonly MinionInfo[] = [
  { slug: "varkul", name: "Varkul", character: "Brutish beast", lore: "Makhluk buas perkasa berotot kekar." },
  { slug: "nethrix", name: "Nethrix", character: "Shadow crawler", lore: "Perayap bayangan yang mengintai dalam gelap." },
  { slug: "zorveth", name: "Zorveth", character: "Armored creature", lore: "Monster berkulit baja tebal dan keras." },
  { slug: "thalgrim", name: "Thalgrim", character: "Stone guardian", lore: "Penjaga batu kuno yang tak kenal ampun." },
  { slug: "xyrath", name: "Xyrath", character: "Winged predator", lore: "Predator bersayap penyergap dari ketinggian." },
  { slug: "othrak", name: "Othrak", character: "Undead warrior", lore: "Prajurit mayat hidup penjaga lorong bawah tanah." },
  { slug: "velmora", name: "Velmora", character: "Cursed spirit", lore: "Roh terkutuk yang meratapi kelemahan naskah." },
  { slug: "grivak", name: "Grivak", character: "Small dungeon beast", lore: "Binatang buas kecil lincah yang suka mengacau." },
];

export const BOSS_BY_FLOOR: Record<number, BossInfo> = {
  1: BOSS_ROSTER.veylith,
  2: BOSS_ROSTER.draeven,
  3: BOSS_ROSTER.kryvax,
  4: BOSS_ROSTER.morvane,
  5: BOSS_ROSTER.nyxara,
  6: BOSS_ROSTER.eldravos,
};

export function getBossForFloor(floor: number): BossInfo {
  return BOSS_BY_FLOOR[floor] ?? BOSS_ROSTER.veylith;
}

export function getMinionForRoom(floorOrder: number, roomIndex: number): MinionInfo {
  const index = Math.abs((floorOrder - 1) * 2 + roomIndex) % MINION_ROSTER.length;
  return MINION_ROSTER[index]!;
}

export function getMonsterDisplayName(slug: string): string {
  const normalized = slug.toLowerCase();
  if (BOSS_ROSTER[normalized]) {
    const b = BOSS_ROSTER[normalized];
    return `${b.name} — ${b.title}`;
  }
  if (normalized.startsWith("boss-floor-")) {
    const floorNum = parseInt(normalized.replace("boss-floor-", ""), 10);
    const b = BOSS_BY_FLOOR[floorNum];
    if (b) return `${b.name} — ${b.title}`;
  }
  if (normalized.startsWith("minion-")) {
    const minionSlug = normalized.replace("minion-", "");
    const m = MINION_ROSTER.find((item) => item.slug === minionSlug);
    if (m) return `${m.name} (${m.character})`;
  }
  const minionDirect = MINION_ROSTER.find((m) => m.slug === normalized);
  if (minionDirect) return `${minionDirect.name} (${minionDirect.character})`;

  // Fallbacks for legacy slugs
  if (normalized === "gap_hunter") return "Veylith — The Void Stalker";
  if (normalized === "aligner") return "Draeven — The Dreadfang";
  if (normalized === "methodologist") return "Kryvax — The Twisted Brood";
  if (normalized === "auditor") return "Morvane — The Gravebound";
  if (normalized === "ghost") return "Nyxara — The Forgotten Keeper";
  if (normalized === "sir_actually") return "Eldravos — The Ancient Sovereign";

  return slug;
}
