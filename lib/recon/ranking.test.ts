import { describe, expect, it } from "vitest";
import { rankFindings } from "./ranking";

describe("rankFindings", () => {
  it("mengurutkan severity, centrality, confidence lalu memberi rank", () => {
    const ranked = rankFindings([
      { id: "a", severity: 2, centrality: 3, confidence: 0.9 },
      { id: "b", severity: 3, centrality: 1, confidence: 0.5 },
      { id: "c", severity: 3, centrality: 3, confidence: 0.6 },
    ]);
    expect(ranked.map((finding) => finding.id)).toEqual(["c", "b", "a"]);
    expect(ranked.map((finding) => finding.rank)).toEqual([1, 2, 3]);
  });
});
