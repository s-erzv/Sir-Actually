import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { buildFloorPlan, WEAKNESS_DIMENSION } from "@/game/map/buildFloorPlan";
import { maxPointsForPlan, rankForPoints } from "@/lib/score";
import type { FindingStub, WeaknessType } from "@/lib/domain/types";
import type { Json } from "@/lib/supabase/database";

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
      const { data: existingReport } = await admin
        .from("reports")
        .select("id")
        .eq("run_id", run.id)
        .maybeSingle();
      if (existingReport) {
        return NextResponse.json({
          pointsTotal: run.points_total,
          maxPoints: 0,
          rank: null,
          finished: true,
        });
      }
      // Run was marked finished but the report write failed earlier; rebuild it.
    } else if (run.status !== "active") {
      throw new ApiError("Run sudah ditutup.", 409);
    }

    const { data: findings, error: findingsError } = await admin
      .from("findings")
      .select("id, weakness_type, severity, centrality, confidence, evidence_quote, rank, status")
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

    const { count: citationCount } = await admin
      .from("citations")
      .select("id", { count: "exact", head: true })
      .eq("research_map_id", map.id)
      .eq("is_injected", false);

    const floors = buildFloorPlan(stubs, (citationCount ?? 0) > 0);
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

    const weakLinks = (findings ?? []).map((finding) => ({
      findingId: finding.id,
      weaknessType: finding.weakness_type,
      severity: finding.severity,
      status: finding.status ?? "untested",
    }));
    const counts = weakLinks.reduce(
      (acc, link) => {
        if (link.status === "defended") acc.defended += 1;
        else if (link.status === "conceded") acc.conceded += 1;
        else if (link.status === "disputed") acc.disputed += 1;
        else acc.untested += 1;
        return acc;
      },
      { defended: 0, conceded: 0, disputed: 0, untested: 0 },
    );
    const readiness = {
      complete: counts.untested === 0,
      ...counts,
      total: weakLinks.length,
      ratio: weakLinks.length > 0 ? counts.defended / weakLinks.length : 0,
    };
    const untested = weakLinks
      .filter((link) => link.status === "untested")
      .map((link) => link.findingId);

    let comparison: Record<string, number> | null = null;
    if (map.version > 1) {
      const { data: previousMap } = await admin
        .from("research_maps")
        .select("id, version")
        .eq("manuscript_id", map.manuscript_id)
        .lt("version", map.version)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (previousMap) {
        const { data: previousFindings } = await admin
          .from("findings")
          .select("weakness_type, evidence_quote")
          .eq("research_map_id", previousMap.id);
        const keyOf = (finding: { weakness_type: string; evidence_quote: string }) =>
          `${finding.weakness_type}|${finding.evidence_quote
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim()}`;
        const previousKeys = new Set((previousFindings ?? []).map(keyOf));
        const currentKeys = new Set((findings ?? []).map(keyOf));
        const stillPresent = [...previousKeys].filter((key) => currentKeys.has(key)).length;
        comparison = {
          previousVersion: previousMap.version,
          currentVersion: map.version,
          stillPresent,
          changed: previousKeys.size - stillPresent,
          newFindings: [...currentKeys].filter((key) => !previousKeys.has(key)).length,
        };
      }
    }

    const { error: reportError } = await admin.from("reports").upsert(
      {
        run_id: run.id,
        readiness: readiness as unknown as Json,
        weak_links: weakLinks as unknown as Json,
        comparison: comparison as unknown as Json,
        untested: untested as unknown as Json,
        prompt_version: "deterministic_v1",
        model_version: null,
      },
      { onConflict: "run_id" },
    );
    if (reportError) throw new ApiError(reportError.message, 500);

    return NextResponse.json({ pointsTotal, maxPoints, rank, finished: true, readiness, comparison });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
