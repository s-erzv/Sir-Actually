/**
 * POST /api/run/revise — close the current run so the player can upload a
 * revised manuscript and start a fresh expedition.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BODY = z.object({ runId: z.string().uuid() });

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
      .select("id, research_map_id, status")
      .eq("id", parsed.data.runId)
      .maybeSingle();
    if (error) throw new ApiError(error.message, 500);
    if (!run) throw new ApiError("Run tidak ditemukan.", 404);
    const { map } = await loadOwnedResearchMap(run.research_map_id, user.id);
    if (run.status !== "active") {
      return NextResponse.json({
        ok: true,
        alreadyClosed: true,
        manuscriptId: map.manuscript_id,
      });
    }

    const { error: updateError } = await admin
      .from("runs")
      .update({ status: "closed_revised", finished_at: new Date().toISOString() })
      .eq("id", run.id);
    if (updateError) throw new ApiError(updateError.message, 500);

    return NextResponse.json({
      ok: true,
      manuscriptId: map.manuscript_id,
      researchMapId: map.id,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
