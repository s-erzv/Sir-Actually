import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getLLMProvider } from "@/lib/llm";
import {
  WEAKNESS_DIMENSION,
  buildFloorPlan,
  getDungeonTier,
} from "@/game/map/buildFloorPlan";
import { applyDungeonDraft, generateDungeonDraft } from "@/lib/dungeon/cartographer";
import type { FindingStub, WeaknessType } from "@/lib/domain/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const BODY = z.object({
  researchMapId: z.string().uuid(),
});

const KNOWN_TYPES = new Set(Object.keys(WEAKNESS_DIMENSION));

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const parsed = BODY.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Input tidak valid.", 400);
    }

    const { map } = await loadOwnedResearchMap(parsed.data.researchMapId, user.id);
    const admin = getAdminSupabase();

    const [{ data: findings, error: findingsError }, { data: claims, error: claimsError }, { data: citations, error: citationsError }] =
      await Promise.all([
        admin
          .from("findings")
          .select("id, weakness_type, severity, centrality, confidence, evidence_quote, rank")
          .eq("research_map_id", map.id),
        admin
          .from("claims")
          .select("kind, text, position")
          .eq("research_map_id", map.id)
          .order("position"),
        admin
          .from("citations")
          .select("id")
          .eq("research_map_id", map.id)
          .eq("is_injected", false)
          .limit(1),
      ]);

    if (findingsError) throw new ApiError(findingsError.message, 500);
    if (claimsError) throw new ApiError(claimsError.message, 500);
    if (citationsError) throw new ApiError(citationsError.message, 500);

    const stubs: FindingStub[] = (findings ?? [])
      .filter((finding) => KNOWN_TYPES.has(finding.weakness_type))
      .map((finding, index) => ({
        id: finding.id,
        weaknessType: finding.weakness_type as WeaknessType,
        severity: Math.min(3, Math.max(1, finding.severity)) as 1 | 2 | 3,
        centrality: Math.min(3, Math.max(1, finding.centrality)) as 1 | 2 | 3,
        confidence: finding.confidence,
        evidenceQuote: finding.evidence_quote,
        floor: 1,
        rank: finding.rank ?? index + 1,
      }));

    const plans = buildFloorPlan(stubs, (citations ?? []).length > 0);
    const claimsSummary =
      (claims ?? [])
        .slice(0, 40)
        .map((claim) => `- ${claim.kind}: ${claim.text}`)
        .join("\n") || map.source_text.slice(0, 4000);

    const provider = getLLMProvider();
    const draft =
      provider.providerName === "dummy" || stubs.length === 0
        ? null
        : await generateDungeonDraft(provider, stubs, claimsSummary);

    return NextResponse.json({
      title: draft?.dungeonTitle ?? "Dungeon Naskah",
      tier: getDungeonTier(stubs),
      floors: draft ? applyDungeonDraft(plans, draft) : plans,
      source: draft ? "ai" : "deterministic",
      model: draft?.model ?? null,
      promptVersion: draft?.promptVersion ?? null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
