import { describe, expect, it } from "vitest";
import { battleLines, shortMonsterName } from "./BattleScene";
import type { CombatOutcome, EvaluationResult } from "@/lib/domain/types";

const evaluation = (damage: number, extra: Partial<EvaluationResult> = {}): EvaluationResult => ({
  scores: [],
  scoreTotal: 0,
  scoreMax: 0,
  damage,
  heartLost: false,
  missing: "",
  ruleCaps: [],
  ...extra,
});

const combat = (extra: Partial<CombatOutcome> = {}): CombatOutcome => ({
  quality: 3,
  qualityLabel: "Kuat",
  usedEvidence: true,
  weaponSlug: "pedang_sitasi",
  weaponName: "Pedang Sitasi",
  weaponKind: "signature",
  attackStyle: "sword",
  damage: 20,
  counterDamage: 0,
  shielded: false,
  absorbed: 0,
  armorBroken: false,
  ...extra,
});

const base = { playerName: "Arka", monsterName: "Veylith", pointsAwarded: 0, lootAwarded: 0, lootKind: "zonk" as const };

describe("battleLines", () => {
  it("narrates a winning hit and the coins", () => {
    const lines = battleLines({
      ...base,
      status: "won",
      evaluation: evaluation(20),
      combat: combat(),
      pointsAwarded: 10,
      lootAwarded: 5,
      lootKind: "coins",
    });
    expect(lines).toEqual([
      "Arka menyerang dengan bukti naskah! Jawaban kuat.",
      "Veylith kena 20 damage!",
      "Veylith tumbang!",
      "Dapat 15 koin!",
    ]);
  });

  it("reports a miss, the counter and what was missing", () => {
    const lines = battleLines({
      ...base,
      status: "active",
      evaluation: evaluation(0, { heartLost: true, missing: "Sebut ukuran sampel." }),
      combat: combat({ usedEvidence: false, counterDamage: 12 }),
    });
    expect(lines[0]).toBe("Arka menyerang! Jawaban kuat.");
    expect(lines).toContain("Serangan meleset!");
    expect(lines).toContain("Veylith membalas! Arka kehilangan 12 HP.");
    expect(lines).toContain("Yang kurang: Sebut ukuran sampel.");
    expect(lines.join(" ")).not.toContain("Heart");
  });

  it("tells how much the armor took and when it broke", () => {
    const lines = battleLines({
      ...base,
      status: "active",
      evaluation: evaluation(5),
      combat: combat({ counterDamage: 4, absorbed: 10, armorBroken: true }),
    });
    expect(lines).toContain("Veylith membalas! Armor menahan 10. Arka kehilangan 4 HP.");
    expect(lines).toContain("Armormu hancur!");
  });
});

describe("shortMonsterName", () => {
  it("keeps only the name", () => {
    expect(shortMonsterName("Veylith — The Void Stalker")).toBe("Veylith");
    expect(shortMonsterName("Varkul (Antek)")).toBe("Varkul");
    expect(shortMonsterName("")).toBe("Penguji");
  });
});
