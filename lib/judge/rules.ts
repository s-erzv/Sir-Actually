/**
 * rules.ts — deterministic rules engine (step 3 of the Judge pipeline).
 *
 * Rules ONLY cap (lower) criterion levels — they never raise them.
 * Each rule is a pure function that can be tested independently.
 * Every applied cap is recorded in RuleCap[] for display to the player.
 *
 * BRIEF.md §8 rules implemented:
 * 1. sample_small_no_justification — n < 30 + correlational/regression → sample_justified max 1
 * 2. n_not_found                   — n not found anywhere → sample_justified max 0
 * 3. p_value_overclaim             — p > 0.05 but "signifikan" in answer → no_overclaim max 0
 * 4. numbers_conflict              — number in answer contradicts source → numbers_consistent max 0
 * 5. numbers_not_in_source         — number in answer not in source at all → numbers_consistent max 1
 * 6. unsupported_citation          — reference in answer not in knownCitations → gap_supported max 1
 * 7. causal_claim_correlational    — causal language + correlational design → no_overclaim max 1
 */

import type { ValidatedScore, RuleCap } from "@/lib/domain/types";
import type { WeaknessType } from "@/lib/domain/types";
import { extractNumbers } from "./extractNumbers";

// ---------------------------------------------------------------------------
// Context passed to applyRules
// ---------------------------------------------------------------------------

export interface RuleContext {
  /** The player's typed answer. */
  playerAnswer: string;
  /** The manuscript source text (research_maps.source_text). */
  sourceText: string;
  /** Weakness type of the current finding. */
  weaknessType: WeaknessType;
  /**
   * Known citation raw_text values from the manuscript.
   * Used to check if the player refers to an unknown reference.
   */
  knownCitations: string[];
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function cap(
  scores: ValidatedScore[],
  caps: RuleCap[],
  criterionId: string,
  maxLevel: 0 | 1,
  reason: string,
): void {
  const idx = scores.findIndex((s) => s.criterionId === criterionId);
  if (idx === -1) return; // criterion not in rubric → nothing to cap
  const current = scores[idx];
  if (current.level > maxLevel) {
    scores[idx] = { ...current, level: maxLevel, capApplied: true };
    caps.push({ criterionId, cappedTo: maxLevel, reason });
  }
}

// ---------------------------------------------------------------------------
// Individual rules (each exported for direct testing)
// ---------------------------------------------------------------------------

/**
 * Rule 1: sample_small_no_justification
 * If the smallest n mentioned in source + answer is < 30 AND the analysis
 * mentions correlation or regression, then sample_justified is capped at 1.
 */
export function ruleSampleSmall(
  scores: ValidatedScore[],
  caps: RuleCap[],
  ctx: RuleContext,
): void {
  const combined = ctx.sourceText + " " + ctx.playerAnswer;
  const nums = extractNumbers(combined);
  if (nums.length === 0) return;

  const minN = Math.min(...nums.filter((n) => n >= 1 && n <= 10000));
  if (minN >= 30) return;

  const analysisPattern = /korelasi|regresi|correlat|regression/i;
  if (!analysisPattern.test(combined)) return;

  cap(
    scores, caps, "sample_justified", 1,
    `n = ${minN} di bawah 30 untuk analisis korelasi/regresi; tidak bisa menegaskan kecukupan sampel`,
  );
}

/**
 * Rule 2: n_not_found
 * If no sample size (n) can be found anywhere (source or answer),
 * sample_justified is capped at 0.
 */
export function ruleNNotFound(
  scores: ValidatedScore[],
  caps: RuleCap[],
  ctx: RuleContext,
): void {
  const combined = ctx.sourceText + " " + ctx.playerAnswer;
  // Look for common n-patterns: "n = 30", "30 responden", "30 sampel", etc.
  const nPattern = /\b(\d+)\s*(responden|sampel|partisipan|participant|subject|orang|n\s*=)/i;
  if (nPattern.test(combined)) return;

  // Also accept bare number if used with correlation/regression context
  const nums = extractNumbers(combined);
  if (nums.some((n) => n >= 1 && n <= 10000)) return;

  cap(
    scores, caps, "sample_justified", 0,
    "Ukuran sampel (n) tidak ditemukan di naskah maupun jawaban",
  );
}

/**
 * Rule 3: p_value_overclaim
 * If any p-value in source or answer is > 0.05 but the answer/source
 * claims "signifikan" or "significant", cap no_overclaim at 0.
 */
export function rulePValueOverclaim(
  scores: ValidatedScore[],
  caps: RuleCap[],
  ctx: RuleContext,
): void {
  const combined = ctx.sourceText + " " + ctx.playerAnswer;

  // Extract p-values: "p = 0.07", "p-value 0.12", etc.
  const pPattern = /\bp[\s-]*(?:value|nilai)?\s*[=<>]?\s*(0\.\d+)/gi;
  let match: RegExpExecArray | null;
  let foundHighP = false;
  while ((match = pPattern.exec(combined)) !== null) {
    const p = parseFloat(match[1]);
    if (!isNaN(p) && p > 0.05) {
      foundHighP = true;
      break;
    }
  }
  if (!foundHighP) return;

  const claimsSignificant = /signifikan|significant/i.test(combined);
  if (!claimsSignificant) return;

  cap(
    scores, caps, "no_overclaim", 0,
    "p-value > 0,05 tapi jawaban/naskah menyebut 'signifikan'",
  );
}

/**
 * Rule 4: numbers_conflict
 * If a number in the player's answer contradicts a number in the source text
 * (same context word, different value), cap numbers_consistent at 0.
 *
 * Detection strategy: look for numbers adjacent to the same keyword in both
 * texts; if they differ, that's a conflict.
 */
export function ruleNumbersConflict(
  scores: ValidatedScore[],
  caps: RuleCap[],
  ctx: RuleContext,
): void {
  // Keywords that anchor a number to a specific claim
  const anchors = ["responden", "sampel", "partisipan", "participant", "r²", "r2", "R²"];

  for (const anchor of anchors) {
    const sourceNums = extractNumbersNear(ctx.sourceText, anchor);
    const answerNums = extractNumbersNear(ctx.playerAnswer, anchor);
    if (sourceNums.length === 0 || answerNums.length === 0) continue;

    // If at least one answer number is NOT in source numbers → conflict
    const hasConflict = answerNums.some((n) => !sourceNums.includes(n));
    if (hasConflict) {
      cap(
        scores, caps, "numbers_consistent", 0,
        `Angka di jawaban (${answerNums.join(",")}) bertentangan dengan angka di naskah (${sourceNums.join(",")}) untuk "${anchor}"`,
      );
      return;
    }
  }
}

/**
 * Rule 5: numbers_not_in_source
 * If the player's answer introduces a number that doesn't appear in the source
 * text at all, cap numbers_consistent at 1.
 */
export function ruleNumbersNotInSource(
  scores: ValidatedScore[],
  caps: RuleCap[],
  ctx: RuleContext,
): void {
  const answerNums = extractNumbers(ctx.playerAnswer);
  if (answerNums.length === 0) return;

  const sourceNums = new Set(extractNumbers(ctx.sourceText));
  const foreignNums = answerNums.filter((n) => !sourceNums.has(n));
  if (foreignNums.length === 0) return;

  cap(
    scores, caps, "numbers_consistent", 1,
    `Angka ${foreignNums.join(",")} dalam jawaban tidak ada di naskah`,
  );
}

/**
 * Rule 6: unsupported_citation
 * If the player's answer mentions a reference that is not in knownCitations,
 * cap gap_supported at 1.
 */
export function ruleUnsupportedCitation(
  scores: ValidatedScore[],
  caps: RuleCap[],
  ctx: RuleContext,
): void {
  if (ctx.knownCitations.length === 0) return;

  // Heuristic: look for "Author Year" patterns like "Sugiyono 2019", "Hair et al. 2014"
  const refPattern = /[A-Z][a-z]+(?:\s+et\s+al\.?)?\s+\d{4}/g;
  const mentioned = ctx.playerAnswer.match(refPattern) ?? [];
  if (mentioned.length === 0) return;

  const knownLower = ctx.knownCitations.map((c) => c.toLowerCase());
  const hasUnknown = mentioned.some(
    (ref) => !knownLower.some((k) => k.includes(ref.toLowerCase())),
  );
  if (!hasUnknown) return;

  cap(
    scores, caps, "gap_supported", 1,
    "Jawaban merujuk referensi yang tidak ada di daftar pustaka naskah",
  );
}

/**
 * Rule 7: causal_claim_correlational
 * If the answer uses causal language but the study design is correlational,
 * cap no_overclaim at 1.
 */
export function ruleCausalClaimCorrelational(
  scores: ValidatedScore[],
  caps: RuleCap[],
  ctx: RuleContext,
): void {
  const causalPattern = /menyebabkan|pengaruh|dampak|mengakibatkan|causes|effect of|impact of/i;
  if (!causalPattern.test(ctx.playerAnswer)) return;

  const correlationalPattern = /korelasi|korelasional|correlat|cross-sectional|cross sectional/i;
  const combined = ctx.sourceText + " " + ctx.playerAnswer;
  if (!correlationalPattern.test(combined)) return;

  cap(
    scores, caps, "no_overclaim", 1,
    "Klaim kausal dalam jawaban tapi desain penelitian korelasional",
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function applyRules(
  scores: ValidatedScore[],
  ctx: RuleContext,
): { scores: ValidatedScore[]; caps: RuleCap[] } {
  // Work on a shallow copy so the original is not mutated
  const mutableScores = scores.map((s) => ({ ...s }));
  const caps: RuleCap[] = [];

  ruleSampleSmall(mutableScores, caps, ctx);
  ruleNNotFound(mutableScores, caps, ctx);
  rulePValueOverclaim(mutableScores, caps, ctx);
  ruleNumbersConflict(mutableScores, caps, ctx);
  ruleNumbersNotInSource(mutableScores, caps, ctx);
  ruleUnsupportedCitation(mutableScores, caps, ctx);
  ruleCausalClaimCorrelational(mutableScores, caps, ctx);

  return { scores: mutableScores, caps };
}

// ---------------------------------------------------------------------------
// Local helper
// ---------------------------------------------------------------------------

function extractNumbersNear(text: string, keyword: string): number[] {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match: number followed by keyword, or keyword followed by number (within 30 chars)
  const pattern = new RegExp(
    `(\\d+[.,]?\\d*)(?=.{0,30}${escaped})|(?<=${escaped}.{0,30})(\\d+[.,]?\\d*)`,
    "gi",
  );
  const results: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const val = parseFloat((m[1] ?? m[2] ?? "").replace(",", "."));
    if (!isNaN(val)) results.push(val);
  }
  return results;
}
