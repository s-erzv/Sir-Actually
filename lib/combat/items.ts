/**
 * Everything the floor merchant sells. Potions go in the bag; a weapon and an
 * armor each fill one slot, and buying a new one replaces the old one.
 *
 * - Weapon: adds attack power before the answer-quality multiplier.
 * - Armor: a shield that takes counter-attack damage before HP does. When the
 *   shield reaches 0 the armor breaks and the slot is empty again.
 *
 * Starting numbers, not calibrated from playtests.
 */

export type ItemKind = "potion" | "weapon" | "armor";

export interface ItemDef {
  slug: string;
  kind: ItemKind;
  name: string;
  price: number;
  /** First floor whose merchant stocks it. */
  minFloor: number;
  icon: string;
  /** Potion: HP restored. */
  heal?: number;
  /** Weapon: attack power added. */
  power?: number;
  /** Armor: shield points. */
  shield?: number;
}

const ICONS = "/assets/ninja-adventure";

export const ITEMS = {
  potion_small: { slug: "potion_small", kind: "potion", name: "Ramuan Kecil", price: 25, minFloor: 1, heal: 40, icon: `${ICONS}/items/potion-life.png` },
  potion_large: { slug: "potion_large", kind: "potion", name: "Ramuan Besar", price: 55, minFloor: 2, heal: 100, icon: `${ICONS}/items/medipack.png` },
  weapon_stick: { slug: "weapon_stick", kind: "weapon", name: "Tongkat Kayu", price: 30, minFloor: 1, power: 4, icon: `${ICONS}/weapons/stick.png` },
  weapon_sword: { slug: "weapon_sword", kind: "weapon", name: "Pedang Besi", price: 70, minFloor: 2, power: 8, icon: `${ICONS}/weapons/sword.png` },
  weapon_axe: { slug: "weapon_axe", kind: "weapon", name: "Kapak Perang", price: 120, minFloor: 3, power: 12, icon: `${ICONS}/weapons/axe.png` },
  weapon_katana: { slug: "weapon_katana", kind: "weapon", name: "Katana", price: 180, minFloor: 4, power: 16, icon: `${ICONS}/weapons/katana.png` },
  weapon_wand: { slug: "weapon_wand", kind: "weapon", name: "Tongkat Sihir", price: 260, minFloor: 5, power: 22, icon: `${ICONS}/weapons/magicwand.png` },
  armor_helmet: { slug: "armor_helmet", kind: "armor", name: "Helm Besi", price: 35, minFloor: 1, shield: 30, icon: `${ICONS}/items/armor-helmet.png` },
  armor_mail: { slug: "armor_mail", kind: "armor", name: "Zirah Besi", price: 80, minFloor: 2, shield: 60, icon: `${ICONS}/items/armor-mail.png` },
  armor_amulet: { slug: "armor_amulet", kind: "armor", name: "Jimat Penjaga", price: 150, minFloor: 4, shield: 100, icon: `${ICONS}/items/armor-amulet.png` },
} as const satisfies Record<string, ItemDef>;

export type ItemSlug = keyof typeof ITEMS;
export const ITEM_SLUGS = Object.keys(ITEMS) as ItemSlug[];

export function getItem(slug: string): ItemDef | null {
  return (ITEMS as Record<string, ItemDef>)[slug] ?? null;
}

/** How many of each equipment kind a merchant shows: the newest unlocked ones. */
const SHELF_PER_KIND = 2;

/**
 * A floor's stock: every potion unlocked by then, plus the best two weapons
 * and best two armors. Deeper floors push weaker gear off the shelf.
 */
export function stockForFloor(floor: number): ItemDef[] {
  const unlocked = (Object.values(ITEMS) as ItemDef[]).filter((item) => item.minFloor <= Math.max(1, floor));
  const potions = unlocked.filter((item) => item.kind === "potion");
  const best = (kind: ItemKind) =>
    unlocked
      .filter((item) => item.kind === kind)
      .sort((a, b) => a.minFloor - b.minFloor)
      .slice(-SHELF_PER_KIND);
  return [...potions, ...best("weapon"), ...best("armor")];
}
