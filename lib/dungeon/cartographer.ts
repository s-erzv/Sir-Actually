import { z } from "zod";
import type { LLMProvider } from "@/lib/llm";
import type { FindingStub, FloorPlan, ResearchDimension } from "@/lib/domain/types";
import { BOSS_BY_DIMENSION, WEAKNESS_DIMENSION, getDungeonTier } from "@/game/map/buildFloorPlan";
import { CARTOGRAPHER_SYSTEM, PROMPT_VERSION, buildCartographerPrompt } from "@/lib/prompts/cartographer_v1";

const DRAFT_SCHEMA = z.object({
  dungeon_title: z.string().trim().min(3).max(80),
  floors: z
    .array(
      z.object({
        dimension: z.enum(["gap", "align", "method", "audit"]),
        theme: z.string().trim().min(3).max(160),
        lore_line: z.string().trim().min(3).max(240),
        boss_slug: z.string().trim().min(3).max(40),
      }),
    )
    .max(4),
});

export interface DungeonDraft {
  dungeonTitle: string;
  floors: Array<{
    dimension: ResearchDimension;
    theme: string;
    lore: string;
    bossSlug: string;
  }>;
  promptVersion: string;
  model: string;
}

const DIMENSION_BOSS: Record<ResearchDimension, string> = {
  gap: BOSS_BY_DIMENSION.gap,
  align: BOSS_BY_DIMENSION.align,
  method: BOSS_BY_DIMENSION.method,
  audit: BOSS_BY_DIMENSION.audit,
};

export async function generateDungeonDraft(
  provider: LLMProvider,
  findings: readonly FindingStub[],
  claimsSummary: string,
): Promise<DungeonDraft | null> {
  const research = findings.filter((finding) => {
    const dimension = WEAKNESS_DIMENSION[finding.weaknessType];
    return dimension === "gap" || dimension === "align" || dimension === "method" || dimension === "audit";
  });
  const active = [...new Set(research.map((finding) => WEAKNESS_DIMENSION[finding.weaknessType] as ResearchDimension))];

  let raw: unknown;
  try {
    raw = await provider.completeJson(
      CARTOGRAPHER_SYSTEM,
      buildCartographerPrompt({
        dungeonTier: getDungeonTier(findings),
        findings: research.map((finding) => ({
          weaknessType: finding.weaknessType,
          dimension: WEAKNESS_DIMENSION[finding.weaknessType],
          severity: finding.severity,
          evidenceQuote: finding.evidenceQuote,
        })),
        claimsSummary,
      }),
      0.3,
    );
  } catch {
    return null;
  }

  const parsed = DRAFT_SCHEMA.safeParse(raw);
  if (!parsed.success) return null;

  const seen = new Set<ResearchDimension>();
  const floors: DungeonDraft["floors"] = [];
  for (const floor of parsed.data.floors) {
    if (!active.includes(floor.dimension)) continue;
    if (seen.has(floor.dimension)) continue;
    if (floor.boss_slug !== DIMENSION_BOSS[floor.dimension]) continue;
    seen.add(floor.dimension);
    floors.push({
      dimension: floor.dimension,
      theme: floor.theme,
      lore: floor.lore_line,
      bossSlug: floor.boss_slug,
    });
  }

  return {
    dungeonTitle: parsed.data.dungeon_title,
    floors,
    promptVersion: PROMPT_VERSION,
    model: provider.modelName,
  };
}

export function applyDungeonDraft(floors: readonly FloorPlan[], draft: DungeonDraft): FloorPlan[] {
  const byDimension = new Map(draft.floors.map((floor) => [floor.dimension, floor]));
  return floors.map((floor) => {
    const decoration = byDimension.get(floor.dimension as ResearchDimension);
    if (!decoration) return floor;
    return {
      ...floor,
      theme: decoration.theme,
      lore: decoration.lore,
    };
  });
}
