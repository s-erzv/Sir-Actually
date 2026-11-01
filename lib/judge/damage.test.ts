import { describe, it, expect } from "vitest";
import { computeDamage, computeHeartLoss, evaluateDamage } from "./damage";
import { BOSS_HP, MINION_HP, HIT_CAP, HEART_LOSS_MAX_SCORE } from "@/lib/balance";

describe("computeDamage", () => {
  it("score 6/6 boss → 45 damage (floor(1.0 × 0.45 × 100))", () => {
    expect(computeDamage(6, 6, true, BOSS_HP)).toBe(45);
  });

  it("score 6/6 minion → 60 damage (floor(1.0 × 0.60 × 100))", () => {
    expect(computeDamage(6, 6, false, MINION_HP)).toBe(60);
  });

  it("score 3/6 boss → 22 damage (floor(0.5 × 0.45 × 100))", () => {
    expect(computeDamage(3, 6, true, BOSS_HP)).toBe(22);
  });

  it("score 0/6 → 0 damage", () => {
    expect(computeDamage(0, 6, true, BOSS_HP)).toBe(0);
    expect(computeDamage(0, 6, false, MINION_HP)).toBe(0);
  });

  it("boss cannot one-shot (max damage 45 < 100 HP)", () => {
    const maxDmg = computeDamage(6, 6, true, BOSS_HP);
    expect(maxDmg).toBeLessThan(BOSS_HP);
    expect(maxDmg).toBe(Math.floor(HIT_CAP.boss * BOSS_HP));
  });

  it("minion cannot one-shot (max damage 60 < 100 HP)", () => {
    const maxDmg = computeDamage(6, 6, false, MINION_HP);
    expect(maxDmg).toBeLessThan(MINION_HP);
    expect(maxDmg).toBe(Math.floor(HIT_CAP.minion * MINION_HP));
  });

  it("scoreMax = 0 → 0 damage (no division by zero)", () => {
    expect(computeDamage(0, 0, true, BOSS_HP)).toBe(0);
  });

  it("never negative", () => {
    expect(computeDamage(-1, 6, true, BOSS_HP)).toBe(0);
  });
});

describe("computeHeartLoss", () => {
  it("score 0 → heart lost", () => {
    expect(computeHeartLoss(0)).toBe(true);
  });

  it(`score ${HEART_LOSS_MAX_SCORE} → heart lost (at threshold)`, () => {
    expect(computeHeartLoss(HEART_LOSS_MAX_SCORE)).toBe(true);
  });

  it("score 2 → heart NOT lost", () => {
    expect(computeHeartLoss(2)).toBe(false);
  });

  it("score 6 → heart NOT lost", () => {
    expect(computeHeartLoss(6)).toBe(false);
  });
});

describe("evaluateDamage — BRIEF §8 mandatory invariants", () => {
  it("jawaban asal (score 1/6) boss: damage < 100, heart lost", () => {
    // Simulates the "5 responden, dipilih acak" scenario after rules cap
    // → sample_justified capped to 1, other criteria = 0; total = 1
    const { damage, heartLost } = evaluateDamage(1, 6, true);
    expect(damage).toBeLessThan(BOSS_HP);
    expect(heartLost).toBe(true);
  });

  it("perfect score boss still cannot one-shot", () => {
    const { damage } = evaluateDamage(6, 6, true);
    expect(damage).toBeLessThan(BOSS_HP);
  });

  it("perfect score minion still cannot one-shot", () => {
    const { damage } = evaluateDamage(6, 6, false);
    expect(damage).toBeLessThan(MINION_HP);
  });

  it("boss needs at least 3 perfect answers to defeat (ceil(100/45) = 3)", () => {
    const maxPerAnswer = computeDamage(6, 6, true, BOSS_HP);
    const answersNeeded = Math.ceil(BOSS_HP / maxPerAnswer);
    expect(answersNeeded).toBeGreaterThanOrEqual(3);
  });

  it("minion needs at least 2 perfect answers to defeat (ceil(100/60) = 2)", () => {
    const maxPerAnswer = computeDamage(6, 6, false, MINION_HP);
    const answersNeeded = Math.ceil(MINION_HP / maxPerAnswer);
    expect(answersNeeded).toBeGreaterThanOrEqual(2);
  });
});

describe("computeDamage — weapon bonus", () => {
  it("applies the weapon multiplier but never exceeds the ceiling", () => {
    expect(computeDamage(6, 6, true, 100, 1.1)).toBe(49);
    expect(computeDamage(6, 6, false, 100, 1.1)).toBe(66);
    expect(computeDamage(6, 6, true, 100, 0.95)).toBe(42);
  });
});
