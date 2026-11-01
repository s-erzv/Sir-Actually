import { describe, expect, it } from "vitest";
import { normalizeForMatch, quoteInChunks } from "./validate";

describe("normalizeForMatch", () => {
  it("normalizes whitespace, quotes, and case", () => {
    expect(normalizeForMatch("  “Sampel   Kecil”  ")).toBe('"sampel kecil"');
  });
});

describe("quoteInChunks", () => {
  it("accepts a normalized substring", () => {
    expect(quoteInChunks("Sampel kecil", [{ text: "Data dari “ sampel   kecil ” ini." }])).toBe(true);
  });

  it("rejects quotes outside the retrieved chunks", () => {
    expect(quoteInChunks("Sampel besar", [{ text: "Data dari sampel kecil." }])).toBe(false);
    expect(quoteInChunks("", [{ text: "apa saja" }])).toBe(false);
  });
});
