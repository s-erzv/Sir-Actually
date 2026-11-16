import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  POINTS_FLAWLESS,
  POINTS_FLOOR_CLEARED,
  POINTS_NO_HEART_LOST,
  POINTS_STREAK_MAX,
  POINTS_STREAK_STEP,
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
      .select("id, research_map_id, status")
      .eq("id", body.runId)
      .maybeSingle();
    if (error) throw new ApiError(error.message, 500);
    if (!run) throw new ApiError("Run tidak ditemukan.", 404);
    if (run.status !== "active") throw new ApiError("Run sudah ditutup.", 409);
    await loadOwnedResearchMap(run.research_map_id, user.id);

    const encounterKey = `floor:${body.floorOrder}`;

    const { data: encounters, error: encounterError } = await admin
      .from("encounters")
      .select("id")
      .eq("run_id", run.id)
      .eq("floor_order", body.floorOrder);
    if (encounterError) throw new ApiError(encounterError.message, 500);

    const encounterIds = (encounters ?? []).map((encounter) => encounter.id);
    const { data: playerTurns, error: turnError } = encounterIds.length
      ? await admin
          .from("turns")
          .select("id")
          .in("encounter_id", encounterIds)
          .eq("role", "player")
      : { data: [] as Array<{ id: string }>, error: null };
    if (turnError) throw new ApiError(turnError.message, 500);

    const turnIds = (playerTurns ?? []).map((turn) => turn.id);
    const { data: evaluations, error: evaluationError } = turnIds.length
      ? await admin
          .from("evaluations")
          .select("score_total, score_max, heart_lost, created_at")
          .in("turn_id", turnIds)
          .order("created_at", { ascending: true })
      : {
          data: [] as Array<{
            score_total: number;
            score_max: number;
            heart_lost: boolean;
            created_at: string;
          }>,
          error: null,
        };
    if (evaluationError) throw new ApiError(evaluationError.message, 500);

    const hasEvaluations = (evaluations ?? []).length > 0;
    const noHeartLost =
      hasEvaluations && !(evaluations ?? []).some((evaluation) => evaluation.heart_lost);
    const flawless =
      noHeartLost &&
      (evaluations ?? []).every(
        (evaluation) =>
          evaluation.score_max > 0 && evaluation.score_total / evaluation.score_max >= 0.75,
      );

    let bestStreak = 0;
    let currentStreak = 0;
    for (const evaluation of evaluations ?? []) {
      const good =
        !evaluation.heart_lost &&
        evaluation.score_max > 0 &&
        evaluation.score_total / evaluation.score_max >= 0.75;
      currentStreak = good ? currentStreak + 1 : 0;
      bestStreak = Math.max(bestStreak, currentStreak);
    }
    const streakBonus =
      bestStreak >= 3
        ? Math.min(POINTS_STREAK_MAX, (bestStreak - 2) * POINTS_STREAK_STEP)
        : 0;

    const events: Array<{ kind: string; amount: number }> = [
      { kind: "floor_cleared", amount: POINTS_FLOOR_CLEARED },
    ];
    if (noHeartLost) events.push({ kind: "no_heart_lost", amount: POINTS_NO_HEART_LOST });
    if (flawless) events.push({ kind: "flawless", amount: POINTS_FLAWLESS });
    if (streakBonus > 0) events.push({ kind: "streak", amount: streakBonus });

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
      .update({ points_total: pointsTotal, current_floor: body.floorOrder + 1 })
      .eq("id", run.id);
    if (updateError) throw new ApiError(updateError.message, 500);

    return NextResponse.json({ pointsAwarded: awarded, pointsTotal });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
