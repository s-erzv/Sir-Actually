import { describe, expect, it } from "vitest";
import { absorbHit, canBuy, healedHp, potionHealFromKey, walletFromEvents, type Wallet } from "./shop";
import { stockForFloor } from "./items";
import { lootKindForKey } from "@/lib/dungeon/loot";

describe("walletFromEvents", () => {
  const events = [
    { kind: "monster_won", amount: 20, encounter_key: "a" },
    { kind: "loot", amount: 4, encounter_key: "b" },
    { kind: "shop", amount: -25, encounter_key: "shop:1:0" },
    { kind: "potion_gain", amount: 0, encounter_key: "shop:1:0:heal40" },
    { kind: "potion_gain", amount: 0, encounter_key: "loot:x:heal40" },
    { kind: "potion_gain", amount: 0, encounter_key: "shop:1:1:heal100" },
    { kind: "potion_use", amount: 0, encounter_key: "use:0" },
  ];

  it("koin = semua event; koin kotor = hanya yang positif", () => {
    const wallet = walletFromEvents(events);
    expect(wallet.coins).toBe(-1);
    expect(wallet.gross).toBe(24);
  });

  it("tas berisi ramuan yang belum diminum, yang tertua diminum dulu", () => {
    expect(walletFromEvents(events).potions).toEqual([40, 100]);
  });

  it("tidak pernah minus ramuan walau event use berlebih", () => {
    expect(walletFromEvents([{ kind: "potion_use", amount: 0 }]).potions).toEqual([]);
  });
});

const empty: Wallet = { coins: 0, gross: 0, potions: [], weapon: null, armor: null };

describe("canBuy", () => {
  it("menolak kalau koin kurang, tanpa memotong apa pun", () => {
    const check = canBuy({ ...empty, coins: 24, gross: 24 }, "potion_small", 1);
    expect(check).toEqual({ ok: false, reason: "Koin kurang: butuh 25, kamu punya 24." });
  });

  it("menolak kalau tas penuh", () => {
    expect(canBuy({ ...empty, coins: 999, potions: [40, 40, 40] }, "potion_small", 1).ok).toBe(false);
  });

  it("mengizinkan saat cukup", () => {
    expect(canBuy({ ...empty, coins: 55, potions: [40] }, "potion_large", 2)).toEqual({ ok: true });
  });

  it("hanya menjual barang yang ada di rak lantai itu", () => {
    expect(canBuy({ ...empty, coins: 999 }, "weapon_katana", 1).ok).toBe(false);
    expect(canBuy({ ...empty, coins: 999 }, "weapon_katana", 4).ok).toBe(true);
  });

  it("tidak menjual senjata yang sedang dipakai", () => {
    const wallet = { ...empty, coins: 999, weapon: { slug: "weapon_stick", name: "Tongkat Kayu", power: 4 } };
    expect(canBuy(wallet, "weapon_stick", 1).ok).toBe(false);
  });
});

describe("perlengkapan", () => {
  it("equip terbaru menggantikan yang lama", () => {
    const wallet = walletFromEvents([
      { kind: "equip", amount: 0, encounter_key: "equip:a:weapon_stick" },
      { kind: "equip", amount: 0, encounter_key: "equip:b:weapon_sword" },
    ]);
    expect(wallet.weapon?.slug).toBe("weapon_sword");
    expect(wallet.weapon?.power).toBe(8);
  });

  it("armor menyerap damage sampai shield habis lalu hancur", () => {
    const events = [
      { kind: "equip", amount: 0, encounter_key: "equip:a:armor_helmet" },
      { kind: "armor_absorb", amount: 0, encounter_key: "absorb:e:1:abs20" },
    ];
    expect(walletFromEvents(events).armor).toMatchObject({ shield: 10, shieldMax: 30 });
    const broken = walletFromEvents([...events, { kind: "armor_absorb", amount: 0, encounter_key: "absorb:e:2:abs10" }]);
    expect(broken.armor).toBeNull();
  });

  it("serapan sebelum armor baru dipasang tidak memotong armor baru", () => {
    const wallet = walletFromEvents([
      { kind: "equip", amount: 0, encounter_key: "equip:a:armor_helmet" },
      { kind: "armor_absorb", amount: 0, encounter_key: "absorb:e:1:abs30" },
      { kind: "equip", amount: 0, encounter_key: "equip:b:armor_mail" },
    ]);
    expect(wallet.armor).toMatchObject({ slug: "armor_mail", shield: 60 });
  });

  it("shield dulu, sisanya ke HP", () => {
    expect(absorbHit(25, 10)).toEqual({ absorbed: 10, hpLoss: 15, broken: true });
    expect(absorbHit(25, 60)).toEqual({ absorbed: 25, hpLoss: 0, broken: false });
    expect(absorbHit(25, 0)).toEqual({ absorbed: 0, hpLoss: 25, broken: false });
  });
});

describe("stockForFloor", () => {
  it("lantai lebih dalam menjual barang lebih kuat", () => {
    const first = stockForFloor(1).map((item) => item.slug);
    expect(first).toEqual(["potion_small", "weapon_stick", "armor_helmet"]);
    const deep = stockForFloor(5).map((item) => item.slug);
    expect(deep).toContain("weapon_wand");
    expect(deep).not.toContain("weapon_stick");
  });
});

describe("ramuan", () => {
  it("tidak pernah melebihi HP maksimum", () => {
    expect(healedHp(280, 300, 40)).toBe(300);
    expect(healedHp(10, 300, 40)).toBe(50);
  });

  it("membaca besar pemulihan dari kunci event", () => {
    expect(potionHealFromKey("shop:2:0:heal100")).toBe(100);
    expect(potionHealFromKey("aneh")).toBe(40);
  });
});

describe("lootKindForKey", () => {
  it("deterministik, dan sekitar 1 dari 5 titik berisi ramuan", () => {
    const keys = Array.from({ length: 500 }, (_, index) => `f1-r${index % 7}:${index},${index * 3}`);
    const potions = keys.filter((key) => lootKindForKey(key) === "potion").length;
    expect(potions).toBeGreaterThan(60);
    expect(potions).toBeLessThan(150);
    expect(lootKindForKey(keys[0]!)).toBe(lootKindForKey(keys[0]!));
  });

  it("jalan buntu lebih sering berisi ramuan", () => {
    const keys = Array.from({ length: 300 }, (_, index) => `f2-nook:${index},${index * 5}`);
    const potions = keys.filter((key) => lootKindForKey(key) === "potion").length;
    expect(potions).toBeGreaterThan(70);
  });
});
