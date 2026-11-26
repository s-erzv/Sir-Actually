import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LLMProvider } from "@/lib/llm";
import { COMPREHENSION } from "@/lib/domain/types";
import { DWELLER_ROOM_BASE } from "@/lib/dungeon/dwellers";
import { generateEncounterQuestions } from "./generate";

/** Minimal Supabase stub: every chain resolves to the table's rows. */
function fakeAdmin(tables: Record<string, { rows: unknown[]; count?: number }>): SupabaseClient {
  const from = (table: string) => {
    const entry = tables[table] ?? { rows: [] };
    const result = { data: entry.rows, error: null, count: entry.count ?? entry.rows.length };
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: entry.rows[0] ?? null, error: null }),
      single: async () => ({ data: entry.rows[0] ?? null, error: null }),
      then: (resolve: (value: typeof result) => unknown) => resolve(result),
    };
    return chain;
  };
  return { from } as unknown as SupabaseClient;
}

const failingProvider = {
  providerName: "test",
  modelName: "test-model",
  completeText: async () => {
    throw new Error("LLM down");
  },
} as unknown as LLMProvider;

describe("generateEncounterQuestions — dweller branch", () => {
  const admin = fakeAdmin({
    findings: {
      rows: [
        {
          id: "finding-1",
          weakness_type: "rq_method_mismatch",
          severity: 2,
          centrality: 2,
          confidence: 0.8,
          evidence_quote: "dianalisis dengan korelasi Pearson",
          rank: 1,
        },
      ],
    },
    citations: { rows: [{ id: "citation-1" }], count: 1 },
    claims: {
      rows: [
        {
          kind: "method",
          text: "Data dianalisis dengan korelasi Pearson.",
          source_quote: "Data dikumpulkan dengan angket dan dianalisis dengan korelasi Pearson.",
          position: 0,
        },
      ],
    },
  });

  const map = {
    id: "map-1",
    manuscript_id: "manuscript-1",
    version: 1,
    source_text: "Data dikumpulkan dengan angket dan dianalisis dengan korelasi Pearson.",
  };

  it("uses the template when the model fails and asks about the claim", async () => {
    const questions = await generateEncounterQuestions({
      admin,
      map: map as never,
      provider: failingProvider,
      bossSlug: "minion-sluagh",
      weaknessType: COMPREHENSION,
      isBoss: false,
      floorOrder: 1,
      roomOrder: DWELLER_ROOM_BASE,
      count: 1,
    });

    expect(questions).toHaveLength(1);
    expect(questions[0]!.weaknessType).toBe(COMPREHENSION);
    expect(questions[0]!.model).toBe("template");
    expect(questions[0]!.attackType).toBe("clarify");
    expect(questions[0]!.targetCriterionIds).toEqual(["claim_explained"]);
    expect(questions[0]!.question.trim().length).toBeGreaterThan(0);
  });

  it("rejects a room that has no dweller on that floor", async () => {
    await expect(
      generateEncounterQuestions({
        admin,
        map: map as never,
        provider: failingProvider,
        bossSlug: "minion-sluagh",
        weaknessType: COMPREHENSION,
        isBoss: false,
        floorOrder: 1,
        roomOrder: DWELLER_ROOM_BASE + 5,
        count: 1,
      }),
    ).rejects.toThrow(/Penghuni tidak ditemukan/);
  });
});
