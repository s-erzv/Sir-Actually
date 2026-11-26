import { NextResponse, type NextRequest } from "next/server";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { buildFloorPlan } from "@/game/map/buildFloorPlan";
import { dwellerCount, eligibleClaims } from "@/lib/dungeon/dwellers";
import type { FindingStub, WeaknessType } from "@/lib/domain/types";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const admin = getAdminSupabase();

    const { data: job, error } = await admin
      .from("recon_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new ApiError(error.message, 500);
    if (!job) throw new ApiError("Job Recon tidak ditemukan.", 404);

    const { data: map } = await admin
      .from("research_maps")
      .select("id, manuscript_id, status")
      .eq("id", job.research_map_id)
      .maybeSingle();
    if (!map) throw new ApiError("Research Map tidak ditemukan.", 404);

    const { data: manuscript } = await admin
      .from("manuscripts")
      .select("owner_id")
      .eq("id", map.manuscript_id)
      .maybeSingle();
    if (!manuscript || manuscript.owner_id !== user.id) {
      throw new ApiError("Akses ditolak.", 403);
    }

    const { data: findings } = await admin
      .from("findings")
      .select(
        "id, weakness_type, claim_id, severity, severity_source, centrality, confidence, detector, evidence_quote, status, rank, version, created_at",
      )
      .eq("research_map_id", map.id)
      .order("rank", { ascending: true, nullsFirst: false });

    const { count: citationCount } = await admin
      .from("citations")
      .select("id", { count: "exact", head: true })
      .eq("research_map_id", map.id)
      .eq("is_injected", false);

    const { data: claims } = await admin
      .from("claims")
      .select("kind, source_quote, position")
      .eq("research_map_id", map.id)
      .order("position");

    const stubs: FindingStub[] = (findings ?? []).map((finding, index) => ({
      id: finding.id,
      weaknessType: finding.weakness_type as WeaknessType,
      severity: Math.min(3, Math.max(1, finding.severity)) as 1 | 2 | 3,
      centrality: Math.min(3, Math.max(1, finding.centrality)) as 1 | 2 | 3,
      confidence: finding.confidence,
      evidenceQuote: finding.evidence_quote,
      floor: 1,
      rank: finding.rank ?? index + 1,
    }));
    const plans = buildFloorPlan(stubs, (citationCount ?? 0) > 0);
    const dwellerCounts = Object.fromEntries(
      plans.map((plan) => [
        plan.floorOrder,
        dwellerCount({
          floorOrder: plan.floorOrder,
          dimension: plan.dimension,
          findingCount: plan.findingIds.length,
          claimCount: eligibleClaims(claims ?? [], plan.dimension).length,
        }),
      ]),
    );

    return NextResponse.json({
      job,
      map,
      citationCount: citationCount ?? 0,
      findings: findings ?? [],
      dwellerCounts,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
