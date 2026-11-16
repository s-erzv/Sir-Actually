/**
 * POST /api/run/retry — reset one floor after a KO.
 *
 * Server-authoritative encounters keep their terminal status in the DB. A
 * client-side floor reset must therefore also reset hearts and reopen every
 * encounter on that floor; otherwise the next answer gets "Encounter selesai".
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { playerHpMax, playerVitals } from "@/lib/combat/playerHp";

export const runtime = "nodejs";

const BODY = z.object({
  runId: z.string().uuid(),
  floorOrder: z.number().int().min(1).max(12),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const parsed = BODY.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Input tidak valid.", 400);
    }
    const body = parsed.data;
    const admin = getAdminSupabase();

    const { data: run, error } = await admin
      .from("runs")
      .select("id, research_map_id, status, character_slug")
      .eq("id", body.runId)
      .maybeSingle();
    if (error) throw new ApiError(error.message, 500);
    if (!run || run.status !== "active") throw new ApiError("Run aktif tidak ditemukan.", 404);
    await loadOwnedResearchMap(run.research_map_id, user.id);

    const hpMax = playerHpMax(run.character_slug);
    const { error: runError } = await admin
      .from("runs")
      .update({ hearts_left: hpMax, current_floor: body.floorOrder })
      .eq("id", run.id);
    if (runError) throw new ApiError(runError.message, 500);

    // Retrying the floor refreshes Sena's once-per-floor shield too.
    const { error: shieldError } = await admin
      .from("run_points_events")
      .delete()
      .eq("run_id", run.id)
      .eq("kind", "shield_used")
      .eq("encounter_key", `shield:${body.floorOrder}`);
    if (shieldError) throw new ApiError(shieldError.message, 500);

    // Reopen the floor's encounters and restore their starting HP. Turns and
    // evaluations stay as history; point events are idempotent by key.
    const { data: encounters, error: encounterError } = await admin
      .from("encounters")
      .select("id, hp_start, finding_id")
      .eq("run_id", run.id)
      .eq("floor_order", body.floorOrder);
    if (encounterError) throw new ApiError(encounterError.message, 500);

    for (const encounter of encounters ?? []) {
      const { error: resetError } = await admin
        .from("encounters")
        .update({
          status: "active",
          hp_end: encounter.hp_start,
          questions_asked: 0,
          resolved_at: null,
        })
        .eq("id", encounter.id);
      if (resetError) throw new ApiError(resetError.message, 500);
    }

    const findingIds = [...new Set((encounters ?? []).map((encounter) => encounter.finding_id).filter(Boolean))] as string[];
    if (findingIds.length > 0) {
      const { error: findingError } = await admin
        .from("findings")
        .update({ status: "untested" })
        .in("id", findingIds);
      if (findingError) throw new ApiError(findingError.message, 500);
    }

    return NextResponse.json({ ok: true, ...playerVitals(hpMax, run.character_slug) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
