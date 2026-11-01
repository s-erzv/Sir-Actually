import { describe, it, expect } from "vitest";
import { resolveBossModel } from "./llm";

describe("resolveBossModel", () => {
  it("routes the current four floors to distinct Kagiro models", () => {
    expect(resolveBossModel("boss-floor-1")).toBe("deepseek-v4.1-flash-1017");
    expect(resolveBossModel("boss-floor-2")).toBe("glm-5-3-flash");
    expect(resolveBossModel("boss-floor-3")).toBe("kimi-k3");
    expect(resolveBossModel("boss-floor-4")).toBe("claude-sonnet-4-6");
  });

  it("routes the final examiner to Claude Sonnet", () => {
    expect(resolveBossModel("auditor")).toBe("claude-sonnet-4-6");
    expect(resolveBossModel("sir_actually")).toBe("claude-sonnet-4-6");
    expect(resolveBossModel("morvane")).toBe("claude-sonnet-4-6");
    expect(resolveBossModel("eldravos")).toBe("claude-sonnet-4-6");
  });

  it("routes canon fantasy monster names and minions correctly", () => {
    expect(resolveBossModel("veylith")).toBe("deepseek-v4.1-flash-1017");
    expect(resolveBossModel("draeven")).toBe("glm-5-3-flash");
    expect(resolveBossModel("kryvax")).toBe("kimi-k3");
    expect(resolveBossModel("nyxara")).toBe("gemini-3-8-flash");
    expect(resolveBossModel("minion-varkul")).toBe("deepseek-v4-flash");
    expect(resolveBossModel("minion-nethrix")).toBe("deepseek-v4-flash");
  });

  it("is case-insensitive and returns undefined for unknown slugs", () => {
    expect(resolveBossModel("GAP_HUNTER")).toBe("deepseek-v4.1-flash-1017");
    expect(resolveBossModel("unknown")).toBeUndefined();
    expect(resolveBossModel(null)).toBeUndefined();
  });
});
