import { describe, expect, it } from "vitest";
import { lootAmountForKey } from "./loot";

describe("lootAmountForKey", () => {
  it("is deterministic and always positive", () => {
    for (const key of ["f1-r0:2,3", "f2-r4:8,9", "loot-xyz"]) {
      const first = lootAmountForKey(key);
      expect(first).toBe(lootAmountForKey(key));
      expect(first).toBeGreaterThanOrEqual(1);
      expect(first).toBeLessThanOrEqual(5);
    }
  });

  it("varies across keys", () => {
    const values = new Set(
      Array.from({ length: 40 }, (_, index) => lootAmountForKey(`f1-r0:${index},3`)),
    );
    expect(values.size).toBeGreaterThan(1);
  });
});
