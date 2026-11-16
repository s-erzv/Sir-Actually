import { NextResponse, type NextRequest } from "next/server";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { isStaleRunProgress } from "@/lib/dungeon/runProgress";
import { currentFloorFromCleared } from "@/lib/dungeon/runFloor";
import { FLOOR_LAYOUT_VERSION } from "@/game/map/buildFloorPlan";

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

    // Layout changed since this run was saved: close it once so the player
    // starts a fresh run instead of resuming mismatched positional keys.
    if (run && isStaleRunProgress(run.progress)) {
      const { error: closeError } = await admin
        .from("runs")
        .update({ status: "finished", finished_at: new Date().toISOString() })
        .eq("id", run.id);
      if (closeError) throw new ApiError(closeError.message, 500);
      return NextResponse.json({ run: null });
    }

    return NextResponse.json({
      run: run
        ? {
            id: run.id,
            characterSlug: run.character_slug,
            weaponSlug: run.weapon_slug,
            hearts: run.hearts_left,
            pointsTotal: run.points_total,
            currentFloor: await resolveCurrentFloor(
              run.id,
              run.current_floor ?? 1,
              run.floor_count,
            ),
            progress: await resolveProgress(run.id, run.progress),
            dungeonTitle: run.dungeon_title,
            floorCount: run.floor_count,
          }
        : null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function resolveCurrentFloor(
  runId: string,
  storedFloor: number,
  floorCount: number | null,
): Promise<number> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("run_points_events")
    .select("encounter_key")
    .eq("run_id", runId)
    .eq("kind", "floor_cleared");
  if (error) throw new ApiError(error.message, 500);

  const cleared = (data ?? [])
    .map((event) => Number(event.encounter_key?.replace(/^floor:/, "")))
    .filter((floor) => Number.isInteger(floor) && floor > 0);
  if (cleared.length === 0) return storedFloor;
  return currentFloorFromCleared(cleared, floorCount);
}

/**
 * Resolved keys are derived from server-owned encounters, not from the
 * client's `progress.resolved` blob. Falls back to the stored blob for runs
 * created before encounter persistence.
 */
async function resolveProgress(  runId: string,
  stored: unknown,
): Promise<{ layoutVersion: number; resolved: string[] }> {
  const admin = getAdminSupabase();
  const { data: encounters, error } = await admin
    .from("encounters")
    .select("floor_order, room_order, status")
    .eq("run_id", runId)
    .in("status", ["won", "conceded", "disputed"]);
  if (error) throw new ApiError(error.message, 500);

  if ((encounters ?? []).length > 0) {
    return {
      layoutVersion: FLOOR_LAYOUT_VERSION,
      resolved: (encounters ?? [])
        .map((encounter) => `f${encounter.floor_order}-r${encounter.room_order}:0`)
        .sort(),
    };
  }

  const resolved =
    stored && typeof stored === "object" && Array.isArray((stored as { resolved?: unknown }).resolved)
      ? ((stored as { resolved: unknown[] }).resolved.filter(
          (key): key is string => typeof key === "string",
        ))
      : [];
  return { layoutVersion: FLOOR_LAYOUT_VERSION, resolved: [...new Set(resolved)].sort() };
}
