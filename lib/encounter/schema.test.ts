import { describe, expect, it } from "vitest";
import { AnswerRequestSchema, pickTargetCriteria } from "./schema";
import { computeHeartLoss } from "@/lib/judge/damage";
import { RUBRICS } from "@/lib/rubrics";

describe("pickTargetCriteria", () => {
  it("minion targets exactly one criterion", () => {
    const criteria = RUBRICS.objective_without_finding;
    expect(pickTargetCriteria(criteria, "clarify", false)).toEqual([criteria[0]]);
  });

  it("boss may target two criteria", () => {
    const criteria = RUBRICS.objective_without_finding;
    expect(pickTargetCriteria(criteria, "counterexample", true)).toEqual([
      criteria[1],
      criteria[2],
    ]);
  });

  it("numbers prefers the criterion that mentions numbers/sample size", () => {
    expect(pickTargetCriteria(RUBRICS.claim_without_citation, "numbers", false)[0]?.id).toBe(
      "numbers_consistent",
    );
    expect(pickTargetCriteria(RUBRICS.sample_unreported, "numbers", false)[0]?.id).toBe(
      "sample_size_stated",
    );
  });
});

describe("computeHeartLoss fairness", () => {
  it("does not cost a Heart when the answer addressed the question", () => {
    expect(computeHeartLoss(0, true)).toBe(false);
    expect(computeHeartLoss(1, true)).toBe(false);
  });

  it("costs a Heart when the answer did not address the question", () => {
    expect(computeHeartLoss(0, false)).toBe(true);
    expect(computeHeartLoss(4, false)).toBe(true);
  });

  it("keeps the legacy score threshold when addressed is unknown", () => {
    expect(computeHeartLoss(0)).toBe(true);
    expect(computeHeartLoss(2)).toBe(false);
  });
});

describe("AnswerRequestSchema length limits", () => {
  const base = {
    encounterId: "enc-1",
    researchMapId: "11111111-1111-4111-8111-111111111111",
    runId: "22222222-2222-4222-8222-222222222222",
    weaknessType: "rq_method_mismatch",
    bossSlug: "minion-sluagh",
    isBoss: false,
    floorOrder: 1,
    roomOrder: 0,
  };

  it("accepts a short answer so the server can grant zero damage", () => {
    expect(AnswerRequestSchema.safeParse({ ...base, answer: "ya" }).success).toBe(true);
  });

  it("rejects an answer longer than 1200 characters", () => {
    expect(AnswerRequestSchema.safeParse({ ...base, answer: "a".repeat(1201) }).success).toBe(false);
  });
});
