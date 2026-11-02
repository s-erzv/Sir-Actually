import { describe, expect, it } from "vitest";
import { attackTypesForLevel, monsterLevelFor } from "./difficulty";

describe("monsterLevelFor", () => {
  it("makes early minions easy and bosses hard", () => {
    expect(monsterLevelFor({ floorOrder: 1, roomOrder: 0, isBoss: false })).toBe(1);
    expect(monsterLevelFor({ floorOrder: 2, roomOrder: 1, isBoss: false })).toBe(1);
    expect(monsterLevelFor({ floorOrder: 3, roomOrder: 0, isBoss: false })).toBe(2);
    expect(monsterLevelFor({ floorOrder: 1, roomOrder: 0, isBoss: true })).toBe(3);
    expect(monsterLevelFor({ floorOrder: 5, roomOrder: 0, isBoss: true, bossSlug: "nyxara" })).toBe(2);
  });
});

describe("attackTypesForLevel", () => {
  const allowed = ["clarify", "challenge", "counterexample", "numbers", "spot", "scenario"] as const;
  it("filters to gentle attacks at level 1", () => {
    expect(attackTypesForLevel(allowed, 1)).toEqual(["clarify", "numbers", "spot"]);
  });
  it("allows harder attacks at level 3", () => {
    expect(attackTypesForLevel(allowed, 3)).toEqual([...allowed]);
  });
});
