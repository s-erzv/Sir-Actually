import { describe, it, expect, afterEach } from "vitest";
import { resolveBossModel, KAGIRO_BOSS_MODELS } from "./llm";

describe("resolveBossModel", () => {
  afterEach(() => {
    delete process.env.LLM_MODEL_BOSS_FLOOR_3;
    delete process.env.LLM_MODEL_MINION_VARKUL;
  });

  it("gives every boss floor and minion a distinct model", () => {
    expect(resolveBossModel("boss-floor-1")).toBe("deepseek-4-1-flash");
    expect(resolveBossModel("boss-floor-2")).toBe("glm5-2");
    expect(resolveBossModel("boss-floor-3")).toBe("glm5-3");
    expect(resolveBossModel("boss-floor-4")).toBe("qwen3.8-plus");
    expect(resolveBossModel("boss-floor-5")).toBe("glm-5-3-flash");
    expect(resolveBossModel("boss-floor-6")).toBe("claude-sonnet-4-6");

    const floors = [1, 2, 3, 4, 5, 6].map((n) => resolveBossModel(`boss-floor-${n}`));
    expect(new Set(floors).size).toBe(floors.length);
  });

  it("routes the final sovereign to Claude Sonnet, and only there", () => {
    expect(resolveBossModel("sir_actually")).toBe("claude-sonnet-4-6");
    expect(resolveBossModel("eldravos")).toBe("claude-sonnet-4-6");
    expect(resolveBossModel("boss-floor-6")).toBe("claude-sonnet-4-6");

    const sonnetFloors = Object.entries(KAGIRO_BOSS_MODELS)
      .filter(([slug, model]) => slug.startsWith("boss-floor-") && model === "claude-sonnet-4-6")
      .map(([slug]) => slug);
    expect(sonnetFloors).toEqual(["boss-floor-6"]);
  });

  it("routes canon fantasy monster names and minions correctly", () => {
    expect(resolveBossModel("veylith")).toBe("deepseek-4-1-flash");
    expect(resolveBossModel("draeven")).toBe("glm5-2");
    expect(resolveBossModel("kryvax")).toBe("glm5-3");
    expect(resolveBossModel("morvane")).toBe("qwen3.8-plus");
    expect(resolveBossModel("nyxara")).toBe("glm-5-3-flash");
    expect(resolveBossModel("minion-varkul")).toBe("deepseek-v4-flash");
    expect(resolveBossModel("minion-nethrix")).toBe("deepseek-v4-flash");
  });

  it("lets env override a single boss without touching the table", () => {
    process.env.LLM_MODEL_BOSS_FLOOR_3 = "qwen3.8-max";
    expect(resolveBossModel("boss-floor-3")).toBe("qwen3.8-max");
    expect(resolveBossModel("boss-floor-2")).toBe("glm5-2");

    process.env.LLM_MODEL_MINION_VARKUL = "glm-5-3-flash";
    expect(resolveBossModel("minion-varkul")).toBe("glm-5-3-flash");
  });

  it("is case-insensitive and returns undefined for unknown slugs", () => {
    expect(resolveBossModel("GAP_HUNTER")).toBe("deepseek-4-1-flash");
    expect(resolveBossModel("unknown")).toBeUndefined();
    expect(resolveBossModel(null)).toBeUndefined();
  });
});
