import { describe, expect, it } from "vitest";
import { isExplored, revealedTileKeys } from "./fog";

describe("fog of war", () => {
  it("reveals a square clipped to the map bounds", () => {
    const keys = revealedTileKeys(10, 10, 0, 0, 1);
    expect(keys).toHaveLength(4);
    expect(keys).toContain("0,0");
    expect(keys).toContain("1,1");
    expect(keys).not.toContain("-1,0");
  });

  it("reveals nothing outside the map", () => {
    expect(revealedTileKeys(5, 5, -10, -10, 1)).toEqual([]);
    expect(isExplored(new Set(["2,3"]), 2, 3)).toBe(true);
    expect(isExplored(new Set(["2,3"]), 3, 2)).toBe(false);
  });
});
