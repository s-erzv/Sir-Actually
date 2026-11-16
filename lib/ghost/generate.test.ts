import { describe, expect, it } from "vitest";
import { fallbackGhostCitation } from "./generate";

describe("fallbackGhostCitation", () => {
  it("is deterministic and looks like an APA reference", () => {
    const first = fallbackGhostCitation(12345);
    expect(first).toBe(fallbackGhostCitation(12345));
    expect(first).toMatch(/\(\d{4}\)\./);
    expect(first).toContain("https://doi.org/10.5555/");
  });

  it("varies by seed", () => {
    expect(fallbackGhostCitation(1)).not.toBe(fallbackGhostCitation(2));
  });
});
