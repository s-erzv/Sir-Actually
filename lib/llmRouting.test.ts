import { describe, it, expect, afterEach } from "vitest";
import {
  resolveAnalysisModel,
  resolveBossModel,
  resolveJudgeModel,
  KAGIRO_BOSS_MODELS,
} from "./llm";

describe("resolveBossModel", () => {
  afterEach(() => {
    delete process.env.LLM_MODEL_BOSS_FLOOR_3;
    delete process.env.LLM_MODEL_MINION_VARKUL;
    delete process.env.LLM_MODEL_JUDGE;
    delete process.env.LLM_MODEL_JUDGE_ELDRAVOS;
    delete process.env.LLM_MODEL_ANALYSIS;
  });

  it("uses cheap model tiers for every boss floor and minion", () => {
    expect(resolveBossModel("boss-floor-1")).toBe("glm-5-3-flash");
    expect(resolveBossModel("boss-floor-2")).toBe("glm-5-3-flash");
    expect(resolveBossModel("boss-floor-3")).toBe("glm-5-3-flash");
    expect(resolveBossModel("boss-floor-4")).toBe("glm-5-3-flash");
    expect(resolveBossModel("boss-floor-5")).toBe("glm-5-3-flash");
    expect(resolveBossModel("boss-floor-6")).toBe("glm-5-3-flash");
  });

  it("never defaults a boss to an expensive model", () => {
    const expensive = new Set(["claude-sonnet-4-6", "glm5-2", "glm5-3", "qwen3.8-plus", "gpt-6-sol", "kimi-k3.1-pro"]);
    expect(Object.values(KAGIRO_BOSS_MODELS).filter((model) => expensive.has(model))).toEqual([]);
  });

  it("routes canon fantasy monster names and minions correctly", () => {
    expect(resolveBossModel("veylith")).toBe("glm-5-3-flash");
    expect(resolveBossModel("draeven")).toBe("glm-5-3-flash");
    expect(resolveBossModel("kryvax")).toBe("glm-5-3-flash");
    expect(resolveBossModel("morvane")).toBe("glm-5-3-flash");
    expect(resolveBossModel("nyxara")).toBe("glm-5-3-flash");
    expect(resolveBossModel("eldravos")).toBe("glm-5-3-flash");
    expect(resolveBossModel("minion-varkul")).toBe("glm-5-3-flash");
    expect(resolveBossModel("minion-nethrix")).toBe("glm-5-3-flash");
  });

  it("lets env override a single boss without touching the table", () => {
    process.env.LLM_MODEL_BOSS_FLOOR_3 = "qwen3.8-max";
    expect(resolveBossModel("boss-floor-3")).toBe("qwen3.8-max");
    expect(resolveBossModel("boss-floor-2")).toBe("glm-5-3-flash");

    process.env.LLM_MODEL_MINION_VARKUL = "kimi-k3";
    expect(resolveBossModel("minion-varkul")).toBe("kimi-k3");
  });

  it("is case-insensitive and returns undefined for unknown slugs", () => {
    expect(resolveBossModel("GAP_HUNTER")).toBe("glm-5-3-flash");
    expect(resolveBossModel("unknown")).toBeUndefined();
    expect(resolveBossModel(null)).toBeUndefined();
  });

  it("routes judges per monster, with env caps", () => {
    expect(resolveJudgeModel("minion-varkul")).toBe("glm-5-3-flash");
    expect(resolveJudgeModel("eldravos")).toBe("glm-5-3-flash");
    expect(resolveJudgeModel(undefined)).toBe("glm-5-3-flash");

    process.env.LLM_MODEL_JUDGE = "kimi-k3";
    expect(resolveJudgeModel("eldravos")).toBe("kimi-k3");

    process.env.LLM_MODEL_JUDGE_ELDRAVOS = "qwen3.8-max";
    expect(resolveJudgeModel("eldravos")).toBe("qwen3.8-max");
    expect(resolveJudgeModel("kryvax")).toBe("kimi-k3");
  });

  it("routes analysis away from LLM_MODEL", () => {
    expect(resolveAnalysisModel()).toBe("glm-5-3-flash");
    process.env.LLM_MODEL_ANALYSIS = "kimi-k3";
    expect(resolveAnalysisModel()).toBe("kimi-k3");
  });
});
