import { describe, expect, it } from "vitest";
import { mergeChunks, retrieveChunks } from "./retrieve";
import type { RagRpcClient, RetrievalResult } from "./types";

function clientWith(data: unknown, error: { message: string } | null = null): RagRpcClient {
  return {
    rpc: async () => ({ data, error }),
  };
}

describe("retrieveChunks", () => {
  it("maps FTS rows and reports strategy", async () => {
    const result = await retrieveChunks(
      clientWith([
        { id: "c1", chunk_index: 10, section_label: "Metode", text: "Sampel 5 orang.", rank: 0.8 },
      ]),
      { manuscriptId: "m1", version: 1, query: "sampel", embedQuery: async () => null },
    );
    expect(result.strategy).toBe("fts");
    expect(result.chunks[0]).toMatchObject({ chunkIndex: 10, sectionLabel: "Metode", source: "fts" });
    expect(result.insufficientEvidence).toBe(false);
  });

  it("returns insufficient evidence for empty results or blank query", async () => {
    expect(
      (await retrieveChunks(clientWith([]), { manuscriptId: "m1", version: 1, query: "sampel", embedQuery: async () => null }))
        .insufficientEvidence,
    ).toBe(true);
    expect(
      (await retrieveChunks(clientWith([]), { manuscriptId: "m1", version: 1, query: "   ", embedQuery: async () => null }))
        .insufficientEvidence,
    ).toBe(true);
  });

  it("reports warnings when the RPC fails", async () => {
    const result = await retrieveChunks(clientWith(null, { message: "permission denied" }), {
      manuscriptId: "m1",
      version: 1,
      query: "sampel",
      embedQuery: async () => null,
    });
    expect(result.strategy).toBe("none");
    expect(result.warnings[0]).toContain("permission denied");
  });
});

describe("mergeChunks", () => {
  it("dedupes by id and sorts by score", () => {
    const a: RetrievalResult = {
      strategy: "fts",
      insufficientEvidence: false,
      warnings: [],
      chunks: [
        { id: "a", chunkIndex: 1, sectionLabel: null, text: "A", score: 0.2, source: "fts" },
        { id: "b", chunkIndex: 2, sectionLabel: null, text: "B", score: 0.9, source: "fts" },
      ],
    };
    const b: RetrievalResult = {
      strategy: "fts",
      insufficientEvidence: false,
      warnings: [],
      chunks: [
        { id: "a", chunkIndex: 1, sectionLabel: null, text: "A", score: 0.7, source: "fts" },
        { id: "c", chunkIndex: 3, sectionLabel: null, text: "C", score: 0.5, source: "fts" },
      ],
    };
    expect(mergeChunks([a, b], 2).map((chunk) => chunk.id)).toEqual(["a", "b"]);
  });
});
