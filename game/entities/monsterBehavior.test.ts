import { describe, expect, it } from "vitest";
import {
  MONSTER_BEHAVIORS,
  behaviorForSpawn,
  shouldChase,
} from "./monsterBehavior";

describe("behaviorForSpawn", () => {
  it("assigns deterministic rotating roles to minions", () => {
    expect([0, 1, 2, 3].map((index) => behaviorForSpawn(false, index))).toEqual([
      "hunter",
      "sentinel",
      "ambusher",
      "hunter",
    ]);
  });

  it("keeps bosses on the standard pursuit behavior", () => {
    expect(behaviorForSpawn(true, 2)).toBe("hunter");
  });
});

describe("shouldChase", () => {
  it("activates hunters anywhere in the room", () => {
    expect(shouldChase("hunter", { x: 1, y: 1 }, { x: 8, y: 6 }, true)).toBe(true);
  });

  it("activates sentinels only within five tiles", () => {
    expect(shouldChase("sentinel", { x: 2, y: 2 }, { x: 5, y: 4 }, true)).toBe(true);
    expect(shouldChase("sentinel", { x: 2, y: 2 }, { x: 6, y: 4 }, true)).toBe(false);
  });

  it("activates ambushers only within two tiles", () => {
    expect(shouldChase("ambusher", { x: 2, y: 2 }, { x: 3, y: 3 }, true)).toBe(true);
    expect(shouldChase("ambusher", { x: 2, y: 2 }, { x: 4, y: 3 }, true)).toBe(false);
  });

  it("never activates outside the monster's room", () => {
    expect(shouldChase("hunter", { x: 2, y: 2 }, { x: 2, y: 3 }, false)).toBe(false);
  });

  it("makes ambushers fastest and sentinels slowest", () => {
    expect(MONSTER_BEHAVIORS.ambusher.moveDuration).toBeLessThan(MONSTER_BEHAVIORS.hunter.moveDuration);
    expect(MONSTER_BEHAVIORS.hunter.moveDuration).toBeLessThan(MONSTER_BEHAVIORS.sentinel.moveDuration);
  });
});
