import { describe, expect, it } from "vitest";
import { checkQuestionQuality, questionSimilarity, templateQuestion } from "./questionQuality";
import { RUBRICS } from "@/lib/rubrics";

const criteria = RUBRICS.objective_without_finding;
const evidenceQuote = "Skor BAI05 dan APO03 masing-masing 68 dan 72.";

describe("checkQuestionQuality", () => {
  it("accepts an open, grounded question that targets a criterion", () => {
    expect(
      checkQuestionQuality({
        question: "Jelaskan temuan mana yang bersesuaian dengan tujuan BAI05?",
        targetCriteria: criteria,
        evidenceQuote,
        sourceText: evidenceQuote,
        maxWords: 28,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects yes/no questions", () => {
    const result = checkQuestionQuality({
      question: "Apakah BAI05 sudah punya temuan?",
      targetCriteria: criteria,
      evidenceQuote,
      sourceText: evidenceQuote,
      maxWords: 28,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invented numbers", () => {
    const result = checkQuestionQuality({
      question: "Mengapa skor 90 dianggap cukup untuk tujuan ini?",
      targetCriteria: criteria,
      evidenceQuote,
      sourceText: evidenceQuote,
      maxWords: 28,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.repair).toContain("90");
  });

  it("rejects questions over the word limit", () => {
    const result = checkQuestionQuality({
      question: `Jelaskan ${"kenapa ".repeat(30)}temuan ini?`,
      targetCriteria: criteria,
      evidenceQuote,
      sourceText: evidenceQuote,
      maxWords: 20,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects near-duplicates", () => {
    const result = checkQuestionQuality({
      question: "Jelaskan temuan mana yang bersesuaian dengan tujuan BAI05?",
      targetCriteria: criteria,
      evidenceQuote,
      sourceText: evidenceQuote,
      previousQuestions: ["Jelaskan temuan mana yang bersesuaian dengan tujuan BAI05?"],
      maxWords: 28,
    });
    expect(result.ok).toBe(false);
  });
});

describe("templateQuestion", () => {
  it("produces a question that passes the quality gate", () => {
    for (const attackType of [
      "clarify",
      "challenge",
      "counterexample",
      "numbers",
      "limitation",
      "spot",
      "scenario",
      "repair",
    ] as const) {
      const question = templateQuestion(attackType, criteria);
      const result = checkQuestionQuality({
        question,
        targetCriteria: criteria,
        evidenceQuote,
        sourceText: evidenceQuote,
        maxWords: 28,
      });
      expect(result.ok, question).toBe(true);
    }
  });
});

describe("questionSimilarity", () => {
  it("scores identical questions at 1", () => {
    expect(questionSimilarity("Jelaskan temuan ini?", "Jelaskan temuan ini?")).toBe(1);
  });
});
