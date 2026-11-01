import { describe, it, expect } from "vitest";
import {
  applyRules,
  ruleSampleSmall,
  ruleNNotFound,
  rulePValueOverclaim,
  ruleNumbersConflict,
  ruleNumbersNotInSource,
  ruleUnsupportedCitation,
  ruleCausalClaimCorrelational,
} from "./rules";
import type { ValidatedScore, RuleCap } from "@/lib/domain/types";
import type { RuleContext } from "./rules";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScores(criterionIds: string[], level: 0 | 1 | 2 = 2): ValidatedScore[] {
  return criterionIds.map((id) => ({
    criterionId: id,
    level,
    quote: "some quote",
    capApplied: false,
  }));
}

function baseCtx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    playerAnswer: "",
    sourceText: "",
    weaknessType: "sample_unreported",
    knownCitations: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// BRIEF §8 mandatory test: "jawaban asal" must NOT be level 2
// ---------------------------------------------------------------------------

describe("MANDATORY: jawaban asal tidak one-shot (BRIEF §8)", () => {
  it("jawaban asal pada sample_unreported: sample_justified dibatasi maks level 1", () => {
    const answer = "5 responden, dipilih acak, menurut saya cukup";
    const sourceText = "Penelitian ini menggunakan analisis korelasi dengan 5 responden.";
    const scores = makeScores(["sample_justified"], 2);
    const caps: RuleCap[] = [];

    ruleSampleSmall(scores, caps, baseCtx({ playerAnswer: answer, sourceText }));

    expect(scores[0].level).toBeLessThanOrEqual(1);
    expect(caps.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 1: sample_small_no_justification
// ---------------------------------------------------------------------------

describe("ruleSampleSmall", () => {
  it("caps sample_justified at 1 when n < 30 and correlational analysis", () => {
    const scores = makeScores(["sample_justified"], 2);
    const caps: RuleCap[] = [];
    ruleSampleSmall(scores, caps, baseCtx({
      sourceText: "analisis korelasi dengan 20 responden",
      playerAnswer: "sampel sudah mencukupi",
    }));
    expect(scores[0].level).toBe(1);
    expect(caps[0].criterionId).toBe("sample_justified");
  });

  it("does NOT cap when n >= 30", () => {
    const scores = makeScores(["sample_justified"], 2);
    const caps: RuleCap[] = [];
    ruleSampleSmall(scores, caps, baseCtx({
      sourceText: "analisis korelasi dengan 50 responden",
      playerAnswer: "",
    }));
    expect(scores[0].level).toBe(2);
    expect(caps).toHaveLength(0);
  });

  it("does NOT cap when no correlational analysis mentioned", () => {
    const scores = makeScores(["sample_justified"], 2);
    const caps: RuleCap[] = [];
    ruleSampleSmall(scores, caps, baseCtx({
      sourceText: "deskriptif dengan 10 responden",
      playerAnswer: "",
    }));
    expect(scores[0].level).toBe(2);
    expect(caps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 2: n_not_found
// ---------------------------------------------------------------------------

describe("ruleNNotFound", () => {
  it("caps sample_justified at 0 when no sample size found", () => {
    const scores = makeScores(["sample_justified"], 2);
    const caps: RuleCap[] = [];
    ruleNNotFound(scores, caps, baseCtx({
      sourceText: "metode yang digunakan adalah survei",
      playerAnswer: "menurut saya sudah memadai",
    }));
    expect(scores[0].level).toBe(0);
    expect(caps[0].cappedTo).toBe(0);
  });

  it("does NOT cap when n is present in source", () => {
    const scores = makeScores(["sample_justified"], 2);
    const caps: RuleCap[] = [];
    ruleNNotFound(scores, caps, baseCtx({
      sourceText: "melibatkan 45 responden dari Jakarta",
      playerAnswer: "sampel sudah dijelaskan",
    }));
    expect(scores[0].level).toBe(2);
    expect(caps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 3: p_value_overclaim
// ---------------------------------------------------------------------------

describe("rulePValueOverclaim", () => {
  it("caps no_overclaim at 0 when p > 0.05 but answer says signifikan", () => {
    const scores = makeScores(["no_overclaim"], 2);
    const caps: RuleCap[] = [];
    rulePValueOverclaim(scores, caps, baseCtx({
      sourceText: "diperoleh p = 0.08",
      playerAnswer: "hasil menunjukkan pengaruh yang signifikan",
    }));
    expect(scores[0].level).toBe(0);
  });

  it("does NOT cap when p <= 0.05", () => {
    const scores = makeScores(["no_overclaim"], 2);
    const caps: RuleCap[] = [];
    rulePValueOverclaim(scores, caps, baseCtx({
      sourceText: "p = 0.03",
      playerAnswer: "hasil signifikan",
    }));
    expect(scores[0].level).toBe(2);
    expect(caps).toHaveLength(0);
  });

  it("does NOT cap when p > 0.05 but no significance claim", () => {
    const scores = makeScores(["no_overclaim"], 2);
    const caps: RuleCap[] = [];
    rulePValueOverclaim(scores, caps, baseCtx({
      sourceText: "p = 0.12",
      playerAnswer: "hasil tidak menunjukkan perbedaan bermakna",
    }));
    expect(scores[0].level).toBe(2);
    expect(caps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 4: numbers_conflict
// ---------------------------------------------------------------------------

describe("ruleNumbersConflict", () => {
  it("caps numbers_consistent at 0 when answer contradicts source", () => {
    const scores = makeScores(["numbers_consistent"], 2);
    const caps: RuleCap[] = [];
    ruleNumbersConflict(scores, caps, baseCtx({
      sourceText: "50 responden direkrut dari universitas",
      playerAnswer: "saya menggunakan 30 responden",
    }));
    expect(scores[0].level).toBe(0);
  });

  it("does NOT cap when numbers agree", () => {
    const scores = makeScores(["numbers_consistent"], 2);
    const caps: RuleCap[] = [];
    ruleNumbersConflict(scores, caps, baseCtx({
      sourceText: "50 responden",
      playerAnswer: "50 responden dari populasi tersebut",
    }));
    expect(scores[0].level).toBe(2);
    expect(caps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 5: numbers_not_in_source
// ---------------------------------------------------------------------------

describe("ruleNumbersNotInSource", () => {
  it("caps numbers_consistent at 1 when answer has number not in source", () => {
    const scores = makeScores(["numbers_consistent"], 2);
    const caps: RuleCap[] = [];
    ruleNumbersNotInSource(scores, caps, baseCtx({
      sourceText: "metode survei digunakan",
      playerAnswer: "sampel sebanyak 42 orang",
    }));
    expect(scores[0].level).toBe(1);
  });

  it("does NOT cap when answer numbers appear in source", () => {
    const scores = makeScores(["numbers_consistent"], 2);
    const caps: RuleCap[] = [];
    ruleNumbersNotInSource(scores, caps, baseCtx({
      sourceText: "42 responden dipilih secara acak",
      playerAnswer: "sampel sebanyak 42 orang",
    }));
    expect(scores[0].level).toBe(2);
    expect(caps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 6: unsupported_citation
// ---------------------------------------------------------------------------

describe("ruleUnsupportedCitation", () => {
  it("caps gap_supported at 1 when answer cites unknown reference", () => {
    const scores = makeScores(["gap_supported"], 2);
    const caps: RuleCap[] = [];
    ruleUnsupportedCitation(scores, caps, baseCtx({
      playerAnswer: "menurut Sugiyono 2019 hal ini sudah lazim",
      knownCitations: ["Hair et al. 2014 - Multivariate Analysis"],
    }));
    expect(scores[0].level).toBe(1);
  });

  it("does NOT cap when citation is in known list", () => {
    const scores = makeScores(["gap_supported"], 2);
    const caps: RuleCap[] = [];
    ruleUnsupportedCitation(scores, caps, baseCtx({
      playerAnswer: "menurut Sugiyono 2019 hal ini sudah lazim",
      knownCitations: ["Sugiyono 2019 - Metode Penelitian"],
    }));
    expect(scores[0].level).toBe(2);
    expect(caps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 7: causal_claim_correlational
// ---------------------------------------------------------------------------

describe("ruleCausalClaimCorrelational", () => {
  it("caps no_overclaim at 1 when causal language used with correlational design", () => {
    const scores = makeScores(["no_overclaim"], 2);
    const caps: RuleCap[] = [];
    ruleCausalClaimCorrelational(scores, caps, baseCtx({
      sourceText: "penelitian korelasi antara X dan Y",
      playerAnswer: "variabel X menyebabkan peningkatan Y",
    }));
    expect(scores[0].level).toBe(1);
  });

  it("does NOT cap when no causal language", () => {
    const scores = makeScores(["no_overclaim"], 2);
    const caps: RuleCap[] = [];
    ruleCausalClaimCorrelational(scores, caps, baseCtx({
      sourceText: "penelitian korelasi",
      playerAnswer: "terdapat hubungan antara X dan Y",
    }));
    expect(scores[0].level).toBe(2);
    expect(caps).toHaveLength(0);
  });

  it("does NOT cap when design is not correlational", () => {
    const scores = makeScores(["no_overclaim"], 2);
    const caps: RuleCap[] = [];
    ruleCausalClaimCorrelational(scores, caps, baseCtx({
      sourceText: "desain eksperimen acak terkontrol",
      playerAnswer: "variabel X menyebabkan peningkatan Y",
    }));
    expect(scores[0].level).toBe(2);
    expect(caps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// applyRules integration: rules never raise levels
// ---------------------------------------------------------------------------

describe("applyRules", () => {
  it("never raises a level above what was given", () => {
    const scores = makeScores(["sample_justified", "no_overclaim", "numbers_consistent"], 0);
    const { scores: out } = applyRules(scores, baseCtx({
      playerAnswer: "jawaban kosong",
      sourceText: "",
    }));
    out.forEach((s) => {
      expect(s.level).toBeLessThanOrEqual(0);
    });
  });

  it("does not mutate the input array", () => {
    const scores = makeScores(["sample_justified"], 2);
    const original = scores[0].level;
    applyRules(scores, baseCtx({
      sourceText: "korelasi 5 responden",
      playerAnswer: "",
    }));
    expect(scores[0].level).toBe(original); // original unchanged
  });
});
