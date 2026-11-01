import { describe, it, expect } from "vitest";
import {
  BOSS_ROSTER,
  MINION_ROSTER,
  BOSS_BY_FLOOR,
  getBossForFloor,
  getMinionForRoom,
  getMonsterDisplayName,
} from "./monsters";

describe("Monster Roster & Naming Hierarchy", () => {
  it("contains all 6 canon bosses", () => {
    expect(BOSS_ROSTER.veylith.name).toBe("Veylith");
    expect(BOSS_ROSTER.veylith.title).toBe("The Void Stalker");
    expect(BOSS_ROSTER.veylith.domain).toBe("GAP HUNTER");

    expect(BOSS_ROSTER.draeven.name).toBe("Draeven");
    expect(BOSS_ROSTER.draeven.title).toBe("The Dreadfang");
    expect(BOSS_ROSTER.draeven.domain).toBe("THE ALIGNER");

    expect(BOSS_ROSTER.kryvax.name).toBe("Kryvax");
    expect(BOSS_ROSTER.kryvax.title).toBe("The Twisted Brood");
    expect(BOSS_ROSTER.kryvax.domain).toBe("METHODOLOGIST");

    expect(BOSS_ROSTER.morvane.name).toBe("Morvane");
    expect(BOSS_ROSTER.morvane.title).toBe("The Gravebound");
    expect(BOSS_ROSTER.morvane.domain).toBe("THE AUDITOR");

    expect(BOSS_ROSTER.nyxara.name).toBe("Nyxara");
    expect(BOSS_ROSTER.nyxara.title).toBe("The Forgotten Keeper");
    expect(BOSS_ROSTER.nyxara.domain).toBe("GHOST LIBRARY");

    expect(BOSS_ROSTER.eldravos.name).toBe("Eldravos");
    expect(BOSS_ROSTER.eldravos.title).toBe("The Ancient Sovereign");
    expect(BOSS_ROSTER.eldravos.domain).toBe("FINAL BOSS");
  });

  it("contains all 8 canon minions", () => {
    expect(MINION_ROSTER).toHaveLength(8);
    const names = MINION_ROSTER.map((m) => m.name);
    expect(names).toEqual([
      "Varkul",
      "Nethrix",
      "Zorveth",
      "Thalgrim",
      "Xyrath",
      "Othrak",
      "Velmora",
      "Grivak",
    ]);
  });

  it("maps floors 1–6 to the respective floor lords and sovereign", () => {
    expect(getBossForFloor(1).name).toBe("Veylith");
    expect(getBossForFloor(2).name).toBe("Draeven");
    expect(getBossForFloor(3).name).toBe("Kryvax");
    expect(getBossForFloor(4).name).toBe("Morvane");
    expect(getBossForFloor(5).name).toBe("Nyxara");
    expect(getBossForFloor(6).name).toBe("Eldravos");
  });

  it("assigns minions predictably to rooms", () => {
    const m1 = getMinionForRoom(1, 0);
    const m2 = getMinionForRoom(1, 1);
    expect(m1.name).toBe("Varkul");
    expect(m2.name).toBe("Nethrix");
  });

  it("formats display names for boss-floor slugs, minion slugs, and legacy slugs", () => {
    expect(getMonsterDisplayName("boss-floor-1")).toBe("Veylith — The Void Stalker");
    expect(getMonsterDisplayName("boss-floor-4")).toBe("Morvane — The Gravebound");
    expect(getMonsterDisplayName("boss-floor-6")).toBe("Eldravos — The Ancient Sovereign");
    expect(getMonsterDisplayName("minion-varkul")).toBe("Varkul (Brutish beast)");
    expect(getMonsterDisplayName("gap_hunter")).toBe("Veylith — The Void Stalker");
    expect(getMonsterDisplayName("sir_actually")).toBe("Eldravos — The Ancient Sovereign");
  });
});
