/**
 * GET /api/encounter/state — server-owned HP/turn state for resuming an
 * encounter. No AI call, just DB.
 */

import { NextResponse, type NextRequest } from "next/server";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { BOSS_HP, MINION_HP } from "@/lib/balance";
import { findBankQuestion } from "@/lib/encounter/questionBank";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const runId = request.nextUrl.searchParams.get("runId");
    const floorOrder = Number(request.nextUrl.searchParams.get("floorOrder"));
    const roomOrder = Number(request.nextUrl.searchParams.get("roomOrder"));
    if (!runId || !Number.isInteger(floorOrder) || !Number.isInteger(roomOrder)) {
      throw new ApiError("runId, floorOrder, dan roomOrder wajib diisi.", 400);
    }

    const encounterKey = request.nextUrl.searchParams.get("encounterKey") ?? undefined;
    const admin = getAdminSupabase();
    const { data: run, error: runError } = await admin
      .from("runs")
      .select("id, research_map_id, status, hearts_left")
      .eq("id", runId)
      .maybeSingle();
    if (runError) throw new ApiError(runError.message, 500);
    if (!run || run.status !== "active") throw new ApiError("Run aktif tidak ditemukan.", 404);
    const { map } = await loadOwnedResearchMap(run.research_map_id, user.id);

    const { data: encounter, error } = await admin
      .from("encounters")
      .select("id, hp_start, hp_end, is_boss, questions_asked, status")
      .eq("run_id", run.id)
      .eq("floor_order", floorOrder)
      .eq("room_order", roomOrder)
      .maybeSingle();
    if (error) throw new ApiError(error.message, 500);

    if (!encounter) {
      return NextResponse.json({ encounter: null, hearts: run.hearts_left });
    }

    const { data: lastBossTurn } = await admin
      .from("turns")
      .select("text, attack_type")
      .eq("encounter_id", encounter.id)
      .eq("role", "boss")
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();
    const bankQuestion = findBankQuestion(
      map.question_bank,
      encounterKey,
      lastBossTurn?.text,
    );

    const hpMax = encounter.is_boss ? BOSS_HP : MINION_HP;
    return NextResponse.json({
      encounter: {
        hp: encounter.hp_end ?? encounter.hp_start ?? hpMax,
        hpMax,
        questionsAsked: encounter.questions_asked,
        status: encounter.status,
        question: bankQuestion?.question ?? lastBossTurn?.text ?? null,
        attackType: bankQuestion?.attackType ?? lastBossTurn?.attack_type ?? null,
        targetCriterionIds: bankQuestion?.targetCriterionIds ?? null,
      },
      hearts: run.hearts_left,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
