import { describe, expect, it } from "vitest";
import type { LLMProvider } from "@/lib/llm";
import { extractResearchMap } from "./researchMap";

const SOURCE = `
1. Pendahuluan
Penelitian ini membahas tata kelola TI pada distributor kecil.
Sistem yang dipakai masih sebatas pencatatan.

2. Metode Penelitian
Studi kasus dengan wawancara dan observasi.

Daftar Pustaka
[1] Anwar, S. (2021). Riset Pendidikan. Bandung: Alfabeta.
[2] Anwar, S. (2021). Riset Pendidikan. Bandung: Alfabeta.
[3] Brown, T. (2020). Research Methods. London: Routledge.
`;

function providerReturning(payload: unknown): LLMProvider {
  return {
    providerName: "test",
    modelName: "test",
    completeJson: async () => payload,
    completeText: async () => "",
    judgeAnswer: async () => ({ criteria: [], missing: "" }),
    generateQuestion: async () => "",
  } as unknown as LLMProvider;
}

describe("extractResearchMap", () => {
  it("drops duplicate claims and duplicate citations", async () => {
    const provider = providerReturning({
      claims: [
        {
          kind: "problem",
          text: "Tata kelola TI belum tertata.",
          source_quote: "Penelitian ini membahas tata kelola TI pada distributor kecil.",
        },
        {
          kind: "problem",
          text: "Tata kelola TI belum tertata.",
          source_quote: "Penelitian ini membahas tata kelola TI pada distributor kecil.",
        },
        {
          kind: "method",
          text: "Studi kasus dipakai.",
          source_quote: "Studi kasus dengan wawancara dan observasi.",
        },
      ],
    });

    const result = await extractResearchMap(provider, SOURCE);

    expect(result.claims).toHaveLength(2);
    expect(result.claims.map((claim) => claim.position)).toEqual([0, 1]);
    expect(result.citations).toHaveLength(2);
  });
});
