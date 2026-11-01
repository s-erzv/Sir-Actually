import { describe, expect, it } from "vitest";
import {
  autoWeaponBonus,
  computeWeaponBonus,
  heartsForLoadout,
  isCharacterUnlocked,
  isValidLoadout,
} from "./loadout";

const source = "Data diambil dari 5 responden di satu kelas. Keterbatasan penelitian ini hanya satu kelas.";

describe("loadout", () => {
  it("validates character and weapon pairing", () => {
    expect(isValidLoadout("arka", "pedang_sitasi")).toBe(true);
    expect(isValidLoadout("arka", "busur_angka")).toBe(false);
    expect(heartsForLoadout("sena")).toBe(4);
  });

  it("gives Busur Angka a bonus when the answer uses a source number", () => {
    const withNumber = computeWeaponBonus({
      characterSlug: "mira",
      weaponSlug: "busur_angka",
      answer: "Sampelnya 5 responden.",
      sourceText: source,
      citations: [],
      firstAnswer: false,
    });
    const withoutNumber = computeWeaponBonus({
      characterSlug: "mira",
      weaponSlug: "busur_angka",
      answer: "Sampelnya cukup.",
      sourceText: source,
      citations: [],
      firstAnswer: false,
    });
    expect(withNumber).toBeCloseTo(1.1);
    expect(withoutNumber).toBe(1);
  });

  it("applies Arka first-answer passive and clamps the total", () => {
    const bonus = computeWeaponBonus({
      characterSlug: "arka",
      weaponSlug: "pedang_sitasi",
      answer: "Data diambil dari 5 responden di satu kelas.",
      sourceText: source,
      citations: [],
      firstAnswer: true,
    });
    expect(bonus).toBe(1.1);
  });

  it("keeps paid characters locked until unlocked", () => {
    expect(isCharacterUnlocked("kiran", [])).toBe(false);
    expect(isCharacterUnlocked("kiran", ["kiran"])).toBe(true);
    expect(isCharacterUnlocked("arka", null)).toBe(true);
  });

  it("auto-picks the weapon whose condition matches the answer", () => {
    const picked = autoWeaponBonus({
      characterSlug: "kiran",
      answer: "Data diambil dari 5 responden di satu kelas.",
      sourceText: source,
      citations: [],
      firstAnswer: false,
    });
    expect(picked.weaponSlug).toBe("busur_jejak");
    expect(picked.bonus).toBeCloseTo(1.1);
  });

  it("gives Vara a bonus when the monster is nearly dead", () => {
    const bonus = computeWeaponBonus({
      characterSlug: "vara",
      weaponSlug: "kapak_vonis",
      answer: "Sampelnya cukup.",
      sourceText: source,
      citations: [],
      firstAnswer: false,
      enemyHpRatio: 0.2,
    });
    expect(bonus).toBeCloseTo(1.1);
  });

  it("gives Lentera Kubur a bonus for a limitation answer", () => {
    expect(
      computeWeaponBonus({
        characterSlug: "sena",
        weaponSlug: "lentera_kubur",
        answer: "Penelitian ini hanya berlaku untuk satu kelas.",
        sourceText: source,
        citations: [],
        firstAnswer: false,
      }),
    ).toBeCloseTo(1.08);
  });
});
