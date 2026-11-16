import { describe, expect, it } from "vitest";
import { findBankQuestion, mergeQuestionBank, parseQuestionBank } from "./questionBank";
import { FLOOR_LAYOUT_VERSION } from "@/game/map/buildFloorPlan";
import type { GeneratedQuestion } from "./schema";

function question(text: string): GeneratedQuestion {
  return {
    questionId: `q-${text}`,
    question: text,
    attackType: "clarify",
    weaknessType: "gap_unsupported",
    targetCriterionIds: ["gap_identified"],
    level: 1,
    promptVersion: "test",
    model: "test",
  };
}

describe("question bank", () => {
  it("rejects stores from another layout version", () => {
    const store = { layoutVersion: FLOOR_LAYOUT_VERSION - 1, banks: { a: [question("Q?")] } };
    expect(parseQuestionBank(store)).toEqual({});
  });

  it("merges without duplicating normalized text", () => {
    const first = question("Jelaskan bukti ini?");
    const merged = mergeQuestionBank(
      { layoutVersion: FLOOR_LAYOUT_VERSION, banks: { "f1-r0:0": [first] } },
      "f1-r0:0",
      [question("  Jelaskan   bukti ini? "), question("Apa angka di naskah?")],
    );
    expect(merged.banks["f1-r0:0"]).toHaveLength(2);
  });

  it("finds a question by normalized text", () => {
    const store = mergeQuestionBank(undefined, "f1-r0:0", [question("Jelaskan bukti ini?")]);
    expect(findBankQuestion(store, "f1-r0:0", " jelaskan bukti ini? ")?.questionId).toBe(
      "q-Jelaskan bukti ini?",
    );
    expect(findBankQuestion(store, "f1-r0:0", "pertanyaan lain?")).toBeUndefined();
  });
});
