import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse, requireUser } from "@/lib/api/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const admin = getAdminSupabase();

    const { data: runs, error } = await admin
      .from("runs")
      .select("id, research_map_id, status, points_total, rank, dungeon_title, started_at, finished_at")
      .in("status", ["finished", "closed_revised"])
      .order("started_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);

    const mapIds = [...new Set((runs ?? []).map((run) => run.research_map_id))];
    const { data: maps } = mapIds.length
      ? await admin.from("research_maps").select("id, manuscript_id").in("id", mapIds)
      : { data: [] as Array<{ id: string; manuscript_id: string }> };

    const manuscriptIds = [...new Set((maps ?? []).map((map) => map.manuscript_id))];
    const { data: manuscripts } = manuscriptIds.length
      ? await admin
          .from("manuscripts")
          .select("id, title, owner_id")
          .in("id", manuscriptIds)
          .eq("owner_id", user.id)
      : { data: [] as Array<{ id: string; title: string; owner_id: string }> };

    const ownedManuscripts = new Set((manuscripts ?? []).map((manuscript) => manuscript.id));
    const manuscriptByMap = new Map(
      (maps ?? []).map((map) => [map.id, map.manuscript_id] as const),
    );
    const titleById = new Map(
      (manuscripts ?? []).map((manuscript) => [manuscript.id, manuscript.title] as const),
    );

    const history = (runs ?? [])
      .filter((run) => {
        const manuscriptId = manuscriptByMap.get(run.research_map_id);
        return manuscriptId ? ownedManuscripts.has(manuscriptId) : false;
      })
      .map((run) => {
        const manuscriptId = manuscriptByMap.get(run.research_map_id);
        return {
          id: run.id,
          status: run.status,
          pointsTotal: run.points_total,
          rank: run.rank,
          dungeonTitle: run.dungeon_title,
          manuscriptTitle: manuscriptId ? (titleById.get(manuscriptId) ?? "Naskah") : "Naskah",
          startedAt: run.started_at,
          finishedAt: run.finished_at,
        };
      });

    return NextResponse.json({ runs: history });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
