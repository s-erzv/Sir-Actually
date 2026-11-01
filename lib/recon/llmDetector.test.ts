import { describe, expect, it } from "vitest";
import type { LLMProvider } from "@/lib/llm";
import { detectLlmFindings } from "./llmDetector";

function providerWith(evidenceQuote: string): LLMProvider {
  return {
    providerName: "test",
    modelName: "test",
    judgeAnswer: async () => ({ criteria: [], missing: "" }),
    generateQuestion: async () => "Apa buktinya?",
    completeText: async () => "",
    completeJson: async () => ({
      findings: [
        {
          claim_index: 0,
          weakness_type: "sample_unreported",
          evidence_quote: evidenceQuote,
          severity: 2,
          centrality: 2,
          confidence: 0.8,
        },
      ],
    }),
  };
}

const input = {
  claims: [{ id: "c1", kind: "method" as const, text: "Sampel tidak dilaporkan.", sourceQuote: "Sampel tidak dilaporkan." }],
  citations: [],
  chunks: [{ section: "Metode", text: "Data diambil dari sampel kecil di satu kelas." }],
  alreadyDetected: [],
};

describe("detectLlmFindings", () => {
  it("keeps a finding whose quote is inside a retrieved chunk", async () => {
    const result = await detectLlmFindings(providerWith("sampel kecil"), input);
    expect(result.findings).toHaveLength(1);
    expect(result.discarded).toBe(0);
  });

  it("discards a finding whose quote is outside retrieved chunks", async () => {
    const result = await detectLlmFindings(providerWith("sampel besar dari seluruh Indonesia"), input);
    expect(result.findings).toHaveLength(0);
    expect(result.discarded).toBe(1);
  });
});
