import { describe, it, expect } from "vitest";
import { validateQuotes, normalizeWs } from "./validateQuotes";
import type { JudgeRawOutput } from "@/lib/domain/types";

const RUBRIC_IDS = ["evidence_present", "reasoning_clear", "source_cited"];

function makeRaw(overrides: Partial<JudgeRawOutput> = {}): JudgeRawOutput {
  return {
    criteria: [
      { id: "evidence_present", level: 2, quote: "5 responden dari komunitas lokal" },
      { id: "reasoning_clear",  level: 1, quote: "menurut saya sudah cukup" },
      { id: "source_cited",     level: 2, quote: "merujuk pada Sugiyono 2019" },
    ],
    missing: "Belum menjelaskan dasar pemilihan ukuran sampel.",
    ...overrides,
  };
}

const ANSWER = "Sampel saya terdiri dari 5 responden dari komunitas lokal, menurut saya sudah cukup, merujuk pada Sugiyono 2019.";

describe("validateQuotes", () => {
  it("keeps valid quotes and their levels", () => {
    const scores = validateQuotes(makeRaw(), ANSWER, RUBRIC_IDS);
    expect(scores).toHaveLength(3);
    expect(scores[0]).toMatchObject({ criterionId: "evidence_present", level: 2, capApplied: false });
    expect(scores[1]).toMatchObject({ criterionId: "reasoning_clear",  level: 1 });
    expect(scores[2]).toMatchObject({ criterionId: "source_cited",     level: 2 });
  });

  it("sets level 0 when quote is not in the answer", () => {
    const raw = makeRaw({
      criteria: [
        { id: "evidence_present", level: 2, quote: "kalimat ini tidak ada di jawaban" },
        { id: "reasoning_clear",  level: 1, quote: "menurut saya sudah cukup" },
        { id: "source_cited",     level: 2, quote: "merujuk pada Sugiyono 2019" },
      ],
    });
    const scores = validateQuotes(raw, ANSWER, RUBRIC_IDS);
    expect(scores[0]).toMatchObject({ criterionId: "evidence_present", level: 0, quote: "" });
  });

  it("sets level 0 when quote is empty", () => {
    const raw = makeRaw({
      criteria: [
        { id: "evidence_present", level: 2, quote: "" },
        { id: "reasoning_clear",  level: 1, quote: "menurut saya sudah cukup" },
        { id: "source_cited",     level: 1, quote: "merujuk pada Sugiyono 2019" },
      ],
    });
    const scores = validateQuotes(raw, ANSWER, RUBRIC_IDS);
    expect(scores[0]).toMatchObject({ criterionId: "evidence_present", level: 0 });
  });

  it("discards criteria not in rubricIds", () => {
    const raw = makeRaw({
      criteria: [
        { id: "evidence_present", level: 1, quote: "5 responden dari komunitas lokal" },
        { id: "UNKNOWN_CRITERION", level: 2, quote: "anything" },
      ],
    });
    const scores = validateQuotes(raw, ANSWER, RUBRIC_IDS);
    expect(scores).toHaveLength(3); // only rubricIds items
    expect(scores.map(s => s.criterionId)).toEqual(RUBRIC_IDS);
    const unknown = scores.find(s => s.criterionId === "UNKNOWN_CRITERION");
    expect(unknown).toBeUndefined();
  });

  it("returns level 0 for criteria absent from Judge output", () => {
    const raw: JudgeRawOutput = {
      criteria: [
        { id: "evidence_present", level: 1, quote: "5 responden dari komunitas lokal" },
        // reasoning_clear and source_cited missing
      ],
      missing: "...",
    };
    const scores = validateQuotes(raw, ANSWER, RUBRIC_IDS);
    const missing1 = scores.find(s => s.criterionId === "reasoning_clear");
    const missing2 = scores.find(s => s.criterionId === "source_cited");
    expect(missing1).toMatchObject({ level: 0, quote: "" });
    expect(missing2).toMatchObject({ level: 0, quote: "" });
  });

  it("normalises whitespace when matching quotes", () => {
    const answerWithExtraSpaces = "Sampel saya  terdiri dari  5 responden.";
    const raw: JudgeRawOutput = {
      criteria: [
        { id: "evidence_present", level: 2, quote: "5 responden" },
      ],
      missing: "",
    };
    const scores = validateQuotes(raw, answerWithExtraSpaces, ["evidence_present"]);
    expect(scores[0]).toMatchObject({ level: 2 });
  });

  it("normalizeWs collapses tabs and newlines", () => {
    expect(normalizeWs("hello\t\nworld  foo")).toBe("hello world foo");
  });
});
