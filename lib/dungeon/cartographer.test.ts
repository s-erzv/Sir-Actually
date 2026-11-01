import { describe, expect, it } from "vitest";
import type { LLMProvider } from "@/lib/llm";
import type { FindingStub } from "@/lib/domain/types";
import { applyDungeonDraft, generateDungeonDraft } from "./cartographer";
import { buildFloorPlan } from "@/game/map/buildFloorPlan";

function providerWith(raw: unknown): LLMProvider {
  return {
    providerName: "test",
    modelName: "test-model",
    judgeAnswer: async () => ({ criteria: [], missing: "" }),
    generateQuestion: async () => "Apa buktinya?",
    completeText: async () => "",
    completeJson: async () => raw,
  };
}

const finding: FindingStub = {
  id: "f1",
  weaknessType: "sample_unreported",
  severity: 2,
  centrality: 2,
  confidence: 0.8,
  evidenceQuote: "Sampel tidak dilaporkan.",
  floor: 1,
  rank: 1,
};

describe("generateDungeonDraft", () => {
  it("accepts only active dimensions with the matching boss", async () => {
    const draft = await generateDungeonDraft(
      providerWith({
        dungeon_title: "Rongga Kryvax",
        floors: [
          { dimension: "method", theme: "Lab terbengkalai", lore_line: "Kryvax menunggu.", boss_slug: "kryvax" },
          { dimension: "audit", theme: "Audit", lore_line: "Morvane.", boss_slug: "morvane" },
          { dimension: "method", theme: "Duplikat", lore_line: "Duplikat.", boss_slug: "kryvax" },
        ],
      }),
      [finding],
      "Klaim metode.",
    );

    expect(draft?.floors).toHaveLength(1);
    expect(draft?.floors[0]?.dimension).toBe("method");
  });

  it("returns null for invalid JSON", async () => {
    const draft = await generateDungeonDraft(providerWith({ nope: true }), [finding], "");
    expect(draft).toBeNull();
  });
});

describe("applyDungeonDraft", () => {
  it("adds theme and lore without changing rooms or counts", () => {
    const floors = buildFloorPlan([finding], true);
    const decorated = applyDungeonDraft(floors, {
      dungeonTitle: "Rongga",
      floors: [{ dimension: "method", theme: "Lab", lore: "Kryvax menunggu.", bossSlug: "kryvax" }],
      promptVersion: "test",
      model: "test",
    });
    const method = decorated.find((floor) => floor.dimension === "method")!;
    expect(method.theme).toBe("Lab");
    expect(method.rooms).toEqual(floors.find((floor) => floor.dimension === "method")!.rooms);
  });
});
