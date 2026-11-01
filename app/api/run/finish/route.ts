import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { buildFloorPlan, WEAKNESS_DIMENSION } from "@/game/map/buildFloorPlan";
import { maxPointsForPlan, rankForPoints } from "@/lib/score";
import type { FindingStub, WeaknessType } from "@/lib/domain/types";

export const runtime = "nodejs";

const BODY = z.object({ runId: z.string().uuid() });
const KNOWN_TYPES = new Set(Object.keys(WEAKNESS_DIMENSION));

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const parsed = BODY.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Input tidak valid.", 400);
    }
    const admin = getAdminSupabase();
    const { data: run, error } = await admin
      .from("runs")
      .select("id, research_map_id, points_total, status, points_credited")
      .eq("id", parsed.data.runId)
      .maybeSingle();
    if (error) throw new ApiError(error.message, 500);
    if (!run) throw new ApiError("Run tidak ditemukan.", 404);
    const { map } = await loadOwnedResearchMap(run.research_map_id, user.id);
    if (run.status === "finished") {
      return NextResponse.json({
        pointsTotal: run.points_total,
        maxPoints: 0,
        rank: null,
        finished: true,
      });
    }

    const { data: findings, error: findingsError } = await admin
      .from("findings")
      .select("id, weakness_type, severity, centrality, confidence, evidence_quote, rank")
      .eq("research_map_id", map.id);
    if (findingsError) throw new ApiError(findingsError.message, 500);

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

    const floors = buildFloorPlan(stubs, true);
    const maxPoints = maxPointsForPlan(floors);
    const pointsTotal = run.points_total;
    const rank = rankForPoints(pointsTotal, maxPoints);

    if (!run.points_credited && pointsTotal > 0) {
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("points_earned")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw new ApiError(profileError.message, 500);

      const { error: creditError } = await admin.from("profiles").upsert(
        {
          id: user.id,
          display_name: user.email?.split("@")[0] ?? null,
          points_earned: (profile?.points_earned ?? 0) + pointsTotal,
        },
        { onConflict: "id" },
      );
      if (creditError) throw new ApiError(creditError.message, 500);
    }

    const { error: updateError } = await admin
      .from("runs")
      .update({
        status: "finished",
        points_total: pointsTotal,
        points_credited: true,
        rank,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    if (updateError) throw new ApiError(updateError.message, 500);

    return NextResponse.json({ pointsTotal, maxPoints, rank, finished: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
