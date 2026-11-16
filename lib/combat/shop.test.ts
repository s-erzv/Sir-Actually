import { describe, expect, it } from "vitest";
import { canBuy, healedHp, potionHealFromKey, walletFromEvents } from "./shop";
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

  it("koin = semua event; poin kotor = hanya yang positif", () => {
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

describe("canBuy", () => {
  it("menolak kalau poin kurang, tanpa memotong apa pun", () => {
    const check = canBuy({ coins: 24, gross: 24, potions: [] }, "potion_small");
    expect(check).toEqual({ ok: false, reason: "Poin kurang: butuh 25, kamu punya 24." });
  });

  it("menolak kalau tas penuh", () => {
    expect(canBuy({ coins: 999, gross: 999, potions: [40, 40, 40] }, "potion_large").ok).toBe(false);
  });

  it("mengizinkan saat cukup", () => {
    expect(canBuy({ coins: 55, gross: 55, potions: [40] }, "potion_large")).toEqual({ ok: true });
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
