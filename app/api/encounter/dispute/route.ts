/**
 * POST /api/encounter/dispute — Objection! marks the encounter and its finding
 * as disputed. No answer is judged and no Heart is lost.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { BOSS_HP, MINION_HP } from "@/lib/balance";
import { BOSS_BY_DIMENSION, WEAKNESS_DIMENSION } from "@/game/map/buildFloorPlan";
import { BOSS_ROSTER } from "@/lib/monsters";
import type { WeaknessType } from "@/lib/domain/types";

export const runtime = "nodejs";

const BODY = z.object({
  runId: z.string().uuid(),
  floorOrder: z.number().int().min(1).max(12),
  roomOrder: z.number().int().min(0).max(40),
  bossSlug: z.string().min(1).max(80),
  weaknessType: z.string().min(1).max(80).default("gap_unsupported"),
  findingId: z.string().uuid().optional(),
  isBoss: z.boolean(),
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
    if (!run || run.status !== "active") throw new ApiError("Run aktif tidak ditemukan.", 404);
    await loadOwnedResearchMap(run.research_map_id, user.id);

    let { data: encounter, error: encounterError } = await admin
      .from("encounters")
      .select("*")
      .eq("run_id", run.id)
      .eq("floor_order", body.floorOrder)
      .eq("room_order", body.roomOrder)
      .maybeSingle();
    if (encounterError) throw new ApiError(encounterError.message, 500);

    if (!encounter) {
      const isBoss = BOSS_ROSTER[body.bossSlug]
        ? true
        : body.bossSlug.startsWith("minion-")
          ? false
          : body.isBoss;
      const hp = isBoss ? BOSS_HP : MINION_HP;
      const dimension = WEAKNESS_DIMENSION[body.weaknessType as WeaknessType] ?? "audit";
      const bossSlug = BOSS_ROSTER[body.bossSlug]
        ? body.bossSlug
        : (BOSS_BY_DIMENSION[dimension] ?? "veylith");
      const { data: created, error: createError } = await admin
        .from("encounters")
        .insert({
          run_id: run.id,
          boss_slug: bossSlug,
          finding_id: body.findingId ?? null,
          is_boss: isBoss,
          floor_order: body.floorOrder,
          room_order: body.roomOrder,
          status: "active",
          hp_start: hp,
          hp_end: hp,
          questions_asked: 0,
        })
        .select("*")
        .single();
      if (createError) throw new ApiError(createError.message, 500);
      encounter = created;
    }

    const resolvedAt = new Date().toISOString();
    const { error: disputeError } = await admin
      .from("encounters")
      .update({ status: "disputed", resolved_at: resolvedAt })
      .eq("id", encounter.id);
    if (disputeError) throw new ApiError(disputeError.message, 500);

    const findingId = encounter.finding_id ?? body.findingId;
    if (findingId) {
      const { error: findingError } = await admin
        .from("findings")
        .update({ status: "disputed" })
        .eq("id", findingId)
        .eq("research_map_id", run.research_map_id);
      if (findingError) throw new ApiError(findingError.message, 500);
    }

    return NextResponse.json({ ok: true, encounterId: encounter.id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
