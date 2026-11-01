import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse, requireUser } from "@/lib/api/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const admin = getAdminSupabase();

    const { data: manuscripts, error } = await admin
      .from("manuscripts")
      .select("id, title, stage, language, field, min_references, created_at")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    interface MapRow {
      id: string;
      manuscript_id: string;
      version: number;
      status: "draft" | "confirmed";
      confirmed_at: string | null;
    }

    const ids = (manuscripts ?? []).map((manuscript) => manuscript.id);
    let maps: MapRow[] = [];
    if (ids.length > 0) {
      const { data } = await admin
        .from("research_maps")
        .select("id, manuscript_id, version, status, confirmed_at")
        .in("manuscript_id", ids)
        .order("version", { ascending: false });
      maps = data ?? [];
    }

    const mapByManuscript = new Map<string, MapRow>();
    for (const map of maps) {
      if (!mapByManuscript.has(map.manuscript_id)) mapByManuscript.set(map.manuscript_id, map);
    }

    const mapIds = maps.map((map) => map.id);
    const { data: findings } = mapIds.length
      ? await admin.from("findings").select("research_map_id").in("research_map_id", mapIds)
      : { data: [] as Array<{ research_map_id: string }> };
    const findingCounts = new Map<string, number>();
    for (const finding of findings ?? []) {
      findingCounts.set(finding.research_map_id, (findingCounts.get(finding.research_map_id) ?? 0) + 1);
    }

    interface ReconRow {
      id: string;
      research_map_id: string;
      status: string;
      created_at: string;
    }
    let reconJobs: ReconRow[] = [];
    if (mapIds.length > 0) {
      const { data } = await admin
        .from("recon_jobs")
        .select("id, research_map_id, status, created_at")
        .in("research_map_id", mapIds)
        .order("created_at", { ascending: false });
      reconJobs = data ?? [];
    }
    const reconByMap = new Map<string, ReconRow>();
    for (const job of reconJobs) {
      if (!reconByMap.has(job.research_map_id)) reconByMap.set(job.research_map_id, job);
    }

    return NextResponse.json({
      manuscripts: (manuscripts ?? []).map((manuscript) => {
        const map = mapByManuscript.get(manuscript.id) ?? null;
        const recon = map ? (reconByMap.get(map.id) ?? null) : null;
        return {
          ...manuscript,
          map,
          recon: recon ? { id: recon.id, status: recon.status } : null,
          findingCount: map ? (findingCounts.get(map.id) ?? 0) : 0,
        };
      }),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
