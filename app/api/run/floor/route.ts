import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  POINTS_FLAWLESS,
  POINTS_FLOOR_CLEARED,
  POINTS_NO_HEART_LOST,
} from "@/lib/balance";

export const runtime = "nodejs";

const BODY = z.object({
  runId: z.string().uuid(),
  floorOrder: z.number().int().min(1).max(12),
  noHeartLost: z.boolean().default(false),
  flawless: z.boolean().default(false),
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
      .select("id, research_map_id")
      .eq("id", body.runId)
      .maybeSingle();
    if (error) throw new ApiError(error.message, 500);
    if (!run) throw new ApiError("Run tidak ditemukan.", 404);
    await loadOwnedResearchMap(run.research_map_id, user.id);

    const encounterKey = `floor:${body.floorOrder}`;
    const events: Array<{ kind: string; amount: number }> = [
      { kind: "floor_cleared", amount: POINTS_FLOOR_CLEARED },
    ];
    if (body.noHeartLost) events.push({ kind: "no_heart_lost", amount: POINTS_NO_HEART_LOST });
    if (body.flawless) events.push({ kind: "flawless", amount: POINTS_FLAWLESS });

    let awarded = 0;
    for (const event of events) {
      const { error: eventError } = await admin.from("run_points_events").insert({
        run_id: run.id,
        kind: event.kind,
        encounter_key: encounterKey,
        seq: 0,
        amount: event.amount,
      });
      if (eventError && eventError.code !== "23505") {
        throw new ApiError(eventError.message, 500);
      }
      if (!eventError) awarded += event.amount;
    }

    const { data: allEvents, error: eventsError } = await admin
      .from("run_points_events")
      .select("amount")
      .eq("run_id", run.id);
    if (eventsError) throw new ApiError(eventsError.message, 500);
    const pointsTotal = (allEvents ?? []).reduce((sum, event) => sum + event.amount, 0);
    const { error: updateError } = await admin
      .from("runs")
      .update({ points_total: pointsTotal })
      .eq("id", run.id);
    if (updateError) throw new ApiError(updateError.message, 500);

    return NextResponse.json({ pointsAwarded: awarded, pointsTotal });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
