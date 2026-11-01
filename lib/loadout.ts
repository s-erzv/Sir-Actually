import { HEART_MAX, WEAPON_DAMAGE_BONUS_MAX, WEAPON_DAMAGE_BONUS_MIN } from "@/lib/balance";

export type CharacterSlug = "arka" | "mira" | "sena" | "kiran" | "vara";
export type WeaponSlug =
  | "pedang_sitasi"
  | "belati_presisi"
  | "busur_angka"
  | "jaring_bukti"
  | "perisai_batas"
  | "lentera_kubur"
  | "busur_jejak"
  | "kompas_rujukan"
  | "kapak_vonis"
  | "rantai_batas";

export interface Loadout {
  characterSlug: CharacterSlug;
  weaponSlug: WeaponSlug;
}

export interface CharacterInfo {
  slug: CharacterSlug;
  name: string;
  title: string;
  role: string;
  passive: string;
  hearts: number;
  weaponSlugs: WeaponSlug[];
  unlockCost: number;
}

export interface WeaponInfo {
  slug: WeaponSlug;
  characterSlug: CharacterSlug;
  name: string;
  baseBonus: number;
  condition: string;
  effect?: "shield";
}

export const CHARACTERS: readonly CharacterInfo[] = [
  {
    slug: "arka",
    name: "Arka",
    title: "Sang Pendebat",
    role: "Penyerang jarak dekat",
    passive: "First Blood: jawaban pertama tiap ruang +0,02 damage.",
    hearts: 3,
    weaponSlugs: ["pedang_sitasi", "belati_presisi"],
    unlockCost: 0,
  },
  {
    slug: "mira",
    name: "Mira",
    title: "Sang Pengarsip",
    role: "Pendukung informasi",
    passive: "Indeks: sekali per lantai menampilkan label bagian bukti.",
    hearts: 3,
    weaponSlugs: ["busur_angka", "jaring_bukti"],
    unlockCost: 0,
  },
  {
    slug: "sena",
    name: "Sena",
    title: "Sang Penjaga",
    role: "Penahan",
    passive: "Tabah: +1 Heart saat run dimulai.",
    hearts: 4,
    weaponSlugs: ["perisai_batas", "lentera_kubur"],
    unlockCost: 0,
  },
  {
    slug: "kiran",
    name: "Kiran",
    title: "Sang Penelusur",
    role: "Pelacak bukti",
    passive: "Jejak: +0,02 damage jika jawaban mengutip 6 kata naskah.",
    hearts: 3,
    weaponSlugs: ["busur_jejak", "kompas_rujukan"],
    unlockCost: 250,
  },
  {
    slug: "vara",
    name: "Vara",
    title: "Sang Eksekutor",
    role: "Penutup laga",
    passive: "Vonis: +0,03 damage saat HP musuh tersisa 30% atau kurang.",
    hearts: 3,
    weaponSlugs: ["kapak_vonis", "rantai_batas"],
    unlockCost: 500,
  },
] as const;

export const WEAPONS: readonly WeaponInfo[] = [
  {
    slug: "pedang_sitasi",
    characterSlug: "arka",
    name: "Pedang Sitasi",
    baseBonus: 1,
    condition: "Bonus jika jawaban menyebut sumber atau mengutip 6 kata naskah.",
  },
  {
    slug: "belati_presisi",
    characterSlug: "arka",
    name: "Belati Presisi",
    baseBonus: 1.02,
    condition: "Bonus jika jawaban mengutip 6 kata persis dari naskah.",
  },
  {
    slug: "busur_angka",
    characterSlug: "mira",
    name: "Busur Angka",
    baseBonus: 1,
    condition: "Bonus jika jawaban memuat angka yang ada di naskah.",
  },
  {
    slug: "jaring_bukti",
    characterSlug: "mira",
    name: "Jaring Bukti",
    baseBonus: 1.03,
    condition: "Bonus jika jawaban menyebut label bagian naskah.",
  },
  {
    slug: "perisai_batas",
    characterSlug: "sena",
    name: "Perisai Batas",
    baseBonus: 0.97,
    condition: "Sekali per lantai, satu kehilangan Heart dibatalkan.",
    effect: "shield",
  },
  {
    slug: "lentera_kubur",
    characterSlug: "sena",
    name: "Lentera Kubur",
    baseBonus: 1.04,
    condition: "Bonus jika jawaban menyebut batas atau keterbatasan.",
  },
  {
    slug: "busur_jejak",
    characterSlug: "kiran",
    name: "Busur Jejak",
    baseBonus: 1,
    condition: "Bonus jika jawaban mengutip 6 kata persis dari naskah.",
  },
  {
    slug: "kompas_rujukan",
    characterSlug: "kiran",
    name: "Kompas Rujukan",
    baseBonus: 1.01,
    condition: "Bonus jika jawaban menyebut penulis atau tahun dari daftar pustaka.",
  },
  {
    slug: "kapak_vonis",
    characterSlug: "vara",
    name: "Kapak Vonis",
    baseBonus: 0.99,
    condition: "Bonus jika HP musuh tersisa 30% atau kurang.",
  },
  {
    slug: "rantai_batas",
    characterSlug: "vara",
    name: "Rantai Batas",
    baseBonus: 1.02,
    condition: "Bonus jika jawaban menyebut batas atau keterbatasan.",
  },
] as const;

function normalize(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function hasSixWordQuote(answer: string, sourceText: string): boolean {
  const a = normalize(answer);
  const words = normalize(sourceText).split(" ").filter(Boolean).slice(0, 15_000);
  if (words.length < 6) return false;
  for (let index = 0; index <= words.length - 6; index += 1) {
    const shingle = words.slice(index, index + 6).join(" ");
    if (shingle.length >= 20 && a.includes(shingle)) return true;
  }
  return false;
}

function mentionsCitation(answer: string, citations: readonly string[]): boolean {
  const a = normalize(answer);
  const tokens = new Set<string>();
  for (const citation of citations) {
    for (const token of citation.split(/[^a-zA-Z0-9]+/)) {
      const clean = token.toLowerCase();
      if (clean.length >= 4 && !/^\d+$/.test(clean)) tokens.add(clean);
    }
  }
  return [...tokens].some((token) => a.includes(token));
}

function mentionsSourceNumber(answer: string, sourceText: string): boolean {
  const sourceNumbers = new Set(sourceText.match(/\d+(?:[.,]\d+)?/g) ?? []);
  const answerNumbers = answer.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return answerNumbers.some((number) => sourceNumbers.has(number));
}

function mentionsSection(answer: string): boolean {
  return /\b(metode|metodologi|hasil|pembahasan|kesimpulan|pendahuluan|daftar pustaka|abstrak)\b/i.test(answer);
}

function mentionsLimitation(answer: string): boolean {
  return /\b(hanya|terbatas|batas|keterbatasan|tidak berlaku|generalisasi)\b/i.test(answer);
}

export function getCharacter(slug: string): CharacterInfo | null {
  return CHARACTERS.find((character) => character.slug === slug) ?? null;
}

export function getWeapon(slug: string): WeaponInfo | null {
  return WEAPONS.find((weapon) => weapon.slug === slug) ?? null;
}

export function isValidLoadout(characterSlug: string, weaponSlug: string): boolean {
  const character = getCharacter(characterSlug);
  const weapon = getWeapon(weaponSlug);
  return Boolean(character && weapon && weapon.characterSlug === character.slug);
}

export function heartsForLoadout(characterSlug: string): number {
  const character = getCharacter(characterSlug);
  return Math.min(HEART_MAX, character?.hearts ?? 3);
}

export function isCharacterUnlocked(
  characterSlug: string,
  unlockedCharacters: readonly string[] | null | undefined,
): boolean {
  const character = getCharacter(characterSlug);
  if (!character) return false;
  return character.unlockCost === 0 || Boolean(unlockedCharacters?.includes(character.slug));
}

/**
 * Weapons are not chosen by the player. Each character brings an arsenal and
 * the server picks the one whose condition best matches the answer.
 */
export function autoWeaponBonus(input: {
  characterSlug: string;
  answer: string;
  sourceText: string;
  citations: readonly string[];
  firstAnswer: boolean;
  enemyHpRatio?: number;
}): { weaponSlug: WeaponSlug; bonus: number } {
  const character = getCharacter(input.characterSlug);
  if (!character) return { weaponSlug: "pedang_sitasi", bonus: 1 };

  let best: { weaponSlug: WeaponSlug; bonus: number } = {
    weaponSlug: character.weaponSlugs[0]!,
    bonus: 1,
  };
  for (const weaponSlug of character.weaponSlugs) {
    const bonus = computeWeaponBonus({ ...input, weaponSlug });
    if (bonus > best.bonus) best = { weaponSlug, bonus };
  }
  return best;
}

export function computeWeaponBonus(input: {
  characterSlug: string;
  weaponSlug: string;
  answer: string;
  sourceText: string;
  citations: readonly string[];
  firstAnswer: boolean;
  enemyHpRatio?: number;
}): number {
  const weapon = getWeapon(input.weaponSlug);
  if (!weapon) return 1;

  let bonus = weapon.baseBonus;
  switch (weapon.slug) {
    case "pedang_sitasi":
      if (mentionsCitation(input.answer, input.citations) || hasSixWordQuote(input.answer, input.sourceText)) {
        bonus += 0.1;
      }
      break;
    case "belati_presisi":
      if (hasSixWordQuote(input.answer, input.sourceText)) bonus += 0.05;
      break;
    case "busur_angka":
      if (mentionsSourceNumber(input.answer, input.sourceText)) bonus += 0.1;
      break;
    case "jaring_bukti":
      if (mentionsSection(input.answer)) bonus += 0.04;
      break;
    case "lentera_kubur":
      if (mentionsLimitation(input.answer)) bonus += 0.04;
      break;
    case "busur_jejak":
      if (hasSixWordQuote(input.answer, input.sourceText)) bonus += 0.08;
      break;
    case "kompas_rujukan":
      if (mentionsCitation(input.answer, input.citations)) bonus += 0.06;
      break;
    case "kapak_vonis":
      if ((input.enemyHpRatio ?? 1) <= 0.3) bonus += 0.09;
      break;
    case "rantai_batas":
      if (mentionsLimitation(input.answer)) bonus += 0.05;
      break;
    default:
      break;
  }

  if (input.characterSlug === "arka" && input.firstAnswer) bonus += 0.02;
  if (input.characterSlug === "kiran" && hasSixWordQuote(input.answer, input.sourceText)) {
    bonus += 0.02;
  }
  if (input.characterSlug === "vara" && (input.enemyHpRatio ?? 1) <= 0.3) {
    bonus += 0.03;
  }

  return Math.min(WEAPON_DAMAGE_BONUS_MAX, Math.max(WEAPON_DAMAGE_BONUS_MIN, bonus));
}
