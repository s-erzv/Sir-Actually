import { describe, expect, it } from "vitest";
import { answerQuality, usesManuscriptEvidence } from "./quality";
import { gearForLevel, monsterLevel, monsterStats } from "./monsterStats";
import { resolveCombat, type ResolveInput } from "./resolve";

const SOURCE =
  "Sampel berjumlah 45 mahasiswa angkatan 2022 yang dipilih secara purposive dari satu program studi.";

describe("answerQuality", () => {
  const q = (scoreTotal: number, scoreMax: number, usedEvidence = false, addressed: boolean | undefined = true) =>
    answerQuality({ scoreTotal, scoreMax, addressed, usedEvidence });

  it("memetakan rasio skor ke mutu dasar 0-4", () => {
    expect(q(0, 2)).toBe(0);
    expect(q(1, 4)).toBe(1);
    expect(q(1, 2)).toBe(2);
    expect(q(3, 4)).toBe(3);
    expect(q(2, 2)).toBe(4);
  });

  it("jawaban di luar topik selalu 0, berapa pun skornya", () => {
    expect(q(2, 2, true, false)).toBe(0);
  });

  it("bukti naskah menaikkan satu tingkat, hanya dari mutu 2 ke atas", () => {
    expect(q(1, 4, true)).toBe(1);
    expect(q(1, 2, true)).toBe(3);
    expect(q(2, 2, true)).toBe(5);
  });

  it("Kritis hanya untuk nilai penuh dengan bukti", () => {
    expect(q(2, 2, false)).toBe(4);
    expect(q(3, 4, true)).toBe(4);
  });
});

describe("usesManuscriptEvidence", () => {
  it("mengenali angka naskah, kutipan 6 kata, dan penulis di daftar pustaka", () => {
    expect(usesManuscriptEvidence("Ada 45 responden.", SOURCE, [])).toBe(true);
    expect(usesManuscriptEvidence("yang dipilih secara purposive dari satu program", SOURCE, [])).toBe(true);
    expect(usesManuscriptEvidence("Menurut Sugiyono cara ini sah.", SOURCE, ["Sugiyono. (2019). Metode."])).toBe(true);
    expect(usesManuscriptEvidence("Menurut saya sudah cukup.", SOURCE, [])).toBe(false);
  });
});

describe("monsterStats", () => {
  it("naik bersama level dan lantai", () => {
    expect(monsterStats("minion", 1)).toEqual({ hp: 45, attack: 30, maxQuestions: 3 });
    expect(monsterStats("minion", 3)).toEqual({ hp: 61, attack: 46, maxQuestions: 4 });
    expect(monsterStats("boss", 2)).toEqual({ hp: 125, attack: 70, maxQuestions: 6 });
    expect(monsterStats("boss", 6).attack).toBe(100);
    expect(monsterStats("dweller", 1)).toEqual({ hp: 22, attack: 20, maxQuestions: 1 });
  });

  it("level dari lantai dan severity, dijepit 1-6", () => {
    expect(monsterLevel({ kind: "minion", floorOrder: 1, severity: 1 })).toBe(1);
    expect(monsterLevel({ kind: "minion", floorOrder: 1, severity: 3 })).toBe(2);
    expect(monsterLevel({ kind: "minion", floorOrder: 4, severity: 3 })).toBe(5);
    expect(monsterLevel({ kind: "boss", floorOrder: 1 })).toBe(2);
    expect(monsterLevel({ kind: "boss", floorOrder: 9 })).toBe(6);
    expect(monsterLevel({ kind: "dweller", floorOrder: 3 })).toBe(3);
  });

  it("monster yang sama membawa perlengkapan lebih baik di level lebih tinggi", () => {
    expect(gearForLevel(1).name).toBe("Pentung");
    expect(gearForLevel(6).name).toBe("Mahkota");
  });
});

describe("resolveCombat", () => {
  const base: ResolveInput = {
    characterSlug: "mira",
    quality: 4,
    usedEvidence: false,
    answer: "Karena desainnya korelasional, bukan eksperimen.",
    sourceText: SOURCE,
    citations: [],
    enemyHpRatio: 1,
    firstAnswer: false,
    monsterAttack: 30,
  };

  it("serangan dasar tanpa bukti dan tanpa senjata", () => {
    const outcome = resolveCombat(base);
    expect(outcome.damage).toBe(24); // 30 x 0.8
    expect(outcome.weaponName).toBe("Tangan kosong");
    expect(outcome.attackStyle).toBe("bow");
  });

  it("bukti dari naskah menambah kekuatan", () => {
    expect(resolveCombat({ ...base, quality: 5, usedEvidence: true }).damage).toBe(44);
  });

  it("senjata yang dibeli menambah kekuatan sebelum dikali mutu", () => {
    const sword = { slug: "weapon_sword", name: "Pedang Besi", power: 8 };
    expect(resolveCombat({ ...base, weapon: sword }).damage).toBe(30); // (30 + 8) x 0.8
  });

  it("pelit: dua jawaban Telak tanpa perlengkapan pas membunuh antek level 1", () => {
    const hit = resolveCombat(base).damage;
    expect(hit * 2).toBeGreaterThanOrEqual(monsterStats("minion", 1).hp);
    expect(hit).toBeLessThan(monsterStats("minion", 1).hp);
  });

  it("satu jawaban sempurna tidak pernah membunuh boss", () => {
    const best = resolveCombat({ ...base, characterSlug: "arka", quality: 5, usedEvidence: true, firstAnswer: true });
    expect(best.damage).toBe(47); // 44 + skill Arka 3
    expect(best.damage).toBeLessThan(monsterStats("boss", 2).hp / 2);
  });

  it("jawaban meleset tidak melukai monster", () => {
    expect(resolveCombat({ ...base, quality: 0 }).damage).toBe(0);
  });

  it("serangan balik: penuh di mutu 0, 40% di mutu 1, nol dari mutu 2", () => {
    expect(resolveCombat({ ...base, quality: 0 }).counterDamage).toBe(30);
    expect(resolveCombat({ ...base, quality: 1 }).counterDamage).toBe(12);
    expect(resolveCombat({ ...base, quality: 2 }).counterDamage).toBe(0);
  });

  it("jawaban terlalu pendek tidak dihukum", () => {
    expect(resolveCombat({ ...base, quality: 0, tooShort: true }).counterDamage).toBe(0);
  });

  it("armor menahan serangan balik dulu, sisanya ke HP", () => {
    const blocked = resolveCombat({ ...base, quality: 0, shield: 60 });
    expect(blocked).toMatchObject({ counterDamage: 0, absorbed: 30, shielded: true, armorBroken: false });
    const cracked = resolveCombat({ ...base, quality: 0, shield: 10 });
    expect(cracked).toMatchObject({ counterDamage: 20, absorbed: 10, shielded: false, armorBroken: true });
  });
});
