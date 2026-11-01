import { NextResponse, type NextRequest } from "next/server";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const researchMapId = request.nextUrl.searchParams.get("researchMapId");
    if (!researchMapId) throw new ApiError("researchMapId wajib diisi.", 400);
    await loadOwnedResearchMap(researchMapId, user.id);

    const admin = getAdminSupabase();
    const { data: run, error } = await admin
      .from("runs")
      .select(
        "id, character_slug, weapon_slug, hearts_left, points_total, current_floor, progress, dungeon_title, floor_count",
      )
      .eq("research_map_id", researchMapId)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new ApiError(error.message, 500);

    return NextResponse.json({
      run: run
        ? {
            id: run.id,
            characterSlug: run.character_slug,
            weaponSlug: run.weapon_slug,
            hearts: run.hearts_left,
            pointsTotal: run.points_total,
            currentFloor: run.current_floor ?? 1,
            progress: run.progress ?? {},
            dungeonTitle: run.dungeon_title,
            floorCount: run.floor_count,
          }
        : null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
