import { NextResponse, type NextRequest } from "next/server";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { DWELLER_ROOM_BASE } from "@/lib/dungeon/dwellers";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const runId = request.nextUrl.searchParams.get("runId");
    if (!runId) throw new ApiError("runId wajib diisi.", 400);

    const admin = getAdminSupabase();
    const { data: run, error } = await admin
      .from("runs")
      .select("id, research_map_id, status, points_total, rank, finished_at, dungeon_title")
      .eq("id", runId)
      .maybeSingle();
    if (error) throw new ApiError(error.message, 500);
    if (!run) throw new ApiError("Run tidak ditemukan.", 404);
    await loadOwnedResearchMap(run.research_map_id, user.id);

    const { data: report, error: reportError } = await admin
      .from("reports")
      .select("*")
      .eq("run_id", run.id)
      .maybeSingle();
    if (reportError) throw new ApiError(reportError.message, 500);

    const { data: events, error: eventsError } = await admin
      .from("run_points_events")
      .select("kind, amount")
      .eq("run_id", run.id);
    if (eventsError) throw new ApiError(eventsError.message, 500);

    const pointsByKind: Record<string, number> = {};
    for (const event of events ?? []) {
      pointsByKind[event.kind] = (pointsByKind[event.kind] ?? 0) + event.amount;
    }

    // Dwellers are comprehension checks, never weaknesses: keep them out of
    // the Weakness Report and report them on their own line.
    const { data: dwellerEncounters, error: dwellerError } = await admin
      .from("encounters")
      .select("status")
      .eq("run_id", run.id)
      .gte("room_order", DWELLER_ROOM_BASE);
    if (dwellerError) throw new ApiError(dwellerError.message, 500);
    const dwellerRows = dwellerEncounters ?? [];
    const comprehension = {
      passed: dwellerRows.filter((row) => row.status === "won").length,
      total: dwellerRows.length,
    };

    return NextResponse.json({
      run: {
        id: run.id,
        status: run.status,
        pointsTotal: run.points_total,
        rank: run.rank,
        finishedAt: run.finished_at,
        dungeonTitle: run.dungeon_title,
      },
      pointsByKind,
      comprehension,
      report: report
        ? {
            readiness: report.readiness,
            weakLinks: report.weak_links,
            comparison: report.comparison,
            untested: report.untested,
            generatedAt: report.generated_at,
          }
        : null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
