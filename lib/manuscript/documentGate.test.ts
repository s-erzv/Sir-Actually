import { describe, expect, it, vi } from "vitest";
import type { LLMProvider } from "@/lib/llm";
import { classifyDocument, decideGate, needsClassification } from "./documentGate";

const research = { kind: "research" as const, reason: "ada rumusan masalah" };
const unclear = { kind: "unclear" as const, reason: "esai opini" };
const notResearch = { kind: "not_research" as const, reason: "ini CV" };

function providerReturning(value: unknown): LLMProvider {
  return {
    providerName: "test",
    modelName: "test",
    judgeAnswer: vi.fn(),
    generateQuestion: vi.fn(),
    completeText: vi.fn(),
    completeJson: vi.fn(async () => {
      if (value instanceof Error) throw value;
      return value;
    }),
  } as unknown as LLMProvider;
}

describe("decideGate", () => {
  it("accepts strong structure without asking the LLM", () => {
    expect(needsClassification(3)).toBe(false);
    expect(decideGate(3, null).action).toBe("accept");
    expect(decideGate(5, notResearch).action).toBe("accept");
  });

  it("accepts a messy paper the LLM recognises", () => {
    expect(decideGate(0, research).action).toBe("accept");
  });

  it("rejects only clear non-papers with almost no structure", () => {
    expect(decideGate(0, notResearch).action).toBe("reject");
    expect(decideGate(1, notResearch).action).toBe("reject");
    expect(decideGate(2, notResearch).action).toBe("confirm");
  });

  it("asks the player when unclear or when the LLM failed", () => {
    expect(decideGate(0, unclear).action).toBe("confirm");
    expect(decideGate(0, null).action).toBe("confirm");
  });
});

describe("classifyDocument", () => {
  it("parses a valid verdict", async () => {
    expect(await classifyDocument(providerReturning(research), "teks")).toEqual(research);
  });

  it("returns null instead of throwing on bad output or LLM errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await classifyDocument(providerReturning({ kind: "paper" }), "teks")).toBeNull();
    expect(await classifyDocument(providerReturning(new Error("LLM 500")), "teks")).toBeNull();
    spy.mockRestore();
  });
});
