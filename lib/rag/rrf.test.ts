import { describe, expect, it } from "vitest";
import { rrfMerge } from "./rrf";

const a = { id: "a" };
const b = { id: "b" };
const c = { id: "c" };

describe("rrfMerge", () => {
  it("merges ranked lists without normalizing raw scores", () => {
    expect(rrfMerge([[a, b], [b, c]], 60, 3).map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("dedupes by id and handles empty lists", () => {
    expect(rrfMerge([[], []])).toEqual([]);
    expect(rrfMerge([[a], [a]], 60, 10)).toHaveLength(1);
  });
});
