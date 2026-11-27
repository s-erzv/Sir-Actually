import { describe, it, expect, afterEach } from "vitest";
import {
  resolveAnalysisModel,
  resolveBossModel,
  resolveJudgeModel,
  BOSS_MODELS,
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
    expect(resolveBossModel("boss-floor-1")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveBossModel("boss-floor-2")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveBossModel("boss-floor-3")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveBossModel("boss-floor-4")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveBossModel("boss-floor-5")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveBossModel("boss-floor-6")).toBe("deepseek/deepseek-v4.1-flash-1017");
  });

  it("never defaults a boss to an expensive model", () => {
    const expensive = new Set(["deepseek/deepseek-v4-pro", "deepseek/deepseek-v4-pro-0813", "~deepseek/deepseek-pro-latest"]);
    expect(Object.values(BOSS_MODELS).filter((model) => expensive.has(model))).toEqual([]);
  });

  it("routes canon fantasy monster names and minions correctly", () => {
    expect(resolveBossModel("veylith")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveBossModel("draeven")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveBossModel("kryvax")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveBossModel("morvane")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveBossModel("nyxara")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveBossModel("eldravos")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveBossModel("minion-varkul")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveBossModel("minion-nethrix")).toBe("deepseek/deepseek-v4.1-flash-1017");
  });

  it("lets env override a single boss without touching the table", () => {
    process.env.LLM_MODEL_BOSS_FLOOR_3 = "qwen3.8-max";
    expect(resolveBossModel("boss-floor-3")).toBe("qwen3.8-max");
    expect(resolveBossModel("boss-floor-2")).toBe("deepseek/deepseek-v4.1-flash-1017");

    process.env.LLM_MODEL_MINION_VARKUL = "kimi-k3";
    expect(resolveBossModel("minion-varkul")).toBe("kimi-k3");
  });

  it("is case-insensitive and returns undefined for unknown slugs", () => {
    expect(resolveBossModel("GAP_HUNTER")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveBossModel("unknown")).toBeUndefined();
    expect(resolveBossModel(null)).toBeUndefined();
  });

  it("routes judges per monster, with env caps", () => {
    expect(resolveJudgeModel("minion-varkul")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveJudgeModel("eldravos")).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(resolveJudgeModel(undefined)).toBe("deepseek/deepseek-v4.1-flash-1017");

    process.env.LLM_MODEL_JUDGE = "kimi-k3";
    expect(resolveJudgeModel("eldravos")).toBe("kimi-k3");

    process.env.LLM_MODEL_JUDGE_ELDRAVOS = "qwen3.8-max";
    expect(resolveJudgeModel("eldravos")).toBe("qwen3.8-max");
    expect(resolveJudgeModel("kryvax")).toBe("kimi-k3");
  });

  it("routes analysis away from LLM_MODEL", () => {
    expect(resolveAnalysisModel()).toBe("deepseek/deepseek-v4.1-flash-1017");
    process.env.LLM_MODEL_ANALYSIS = "kimi-k3";
    expect(resolveAnalysisModel()).toBe("kimi-k3");
  });
});
