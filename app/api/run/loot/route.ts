/**
 * POST /api/run/loot — bank one collected loot pickup.
 * Amount is derived server-side; the stable loot key makes it idempotent.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { lootAmountForKey } from "@/lib/dungeon/loot";
import { lootSpotsForFloor } from "@/lib/dungeon/lootSpots";
import { buildFloorPlan, WEAKNESS_DIMENSION } from "@/game/map/buildFloorPlan";
import { generateFloorFromPlan } from "@/game/map/generateFloor";
import type { FindingStub, WeaknessType } from "@/lib/domain/types";

export const runtime = "nodejs";

const BODY = z.object({
  runId: z.string().uuid(),
  lootKey: z.string().min(3).max(120),
});

const LOOT_KEY = /^f(\d+)-r(\d+):(\d+),(\d+)$/;
const KNOWN_TYPES = new Set(Object.keys(WEAKNESS_DIMENSION));

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
    const { map } = await loadOwnedResearchMap(run.research_map_id, user.id);

    const keyMatch = LOOT_KEY.exec(body.lootKey);
    if (!keyMatch) throw new ApiError("Loot key tidak valid.", 400);
    const floorOrder = Number(keyMatch[1]);

    const [{ data: findings, error: findingsError }, { count: citationCount }] = await Promise.all([
      admin
        .from("findings")
        .select("id, weakness_type, severity, centrality, confidence, evidence_quote, rank")
        .eq("research_map_id", map.id),
      admin
        .from("citations")
        .select("id", { count: "exact", head: true })
        .eq("research_map_id", map.id)
        .eq("is_injected", false),
    ]);
    if (findingsError) throw new ApiError(findingsError.message, 500);

    const stubs: FindingStub[] = (findings ?? [])
      .filter((finding) => KNOWN_TYPES.has(finding.weakness_type))
      .map((finding, index) => ({
        id: finding.id,
        weaknessType: finding.weakness_type as WeaknessType,
        severity: Math.min(3, Math.max(1, finding.severity)) as 1 | 2 | 3,
        centrality: Math.min(3, Math.max(1, finding.centrality)) as 1 | 2 | 3,
        confidence: finding.confidence,
        evidenceQuote: finding.evidence_quote,
        floor: 1,
        rank: finding.rank ?? index + 1,
      }));

    const floorPlan = buildFloorPlan(stubs, (citationCount ?? 0) > 0).find(
      (floor) => floor.floorOrder === floorOrder,
    );
    if (!floorPlan) throw new ApiError("Lantai tidak ditemukan.", 404);
    const floorMap = generateFloorFromPlan(floorPlan, 20261101 + (floorOrder - 1));
    const valid = lootSpotsForFloor(floorMap).some((spot) => spot.key === body.lootKey);
    if (!valid) throw new ApiError("Loot tidak ada di lantai ini.", 400);

    const amount = lootAmountForKey(body.lootKey);
    const { error: insertError } = await admin.from("run_points_events").insert({
      run_id: run.id,
      kind: "loot",
      encounter_key: body.lootKey,
      seq: 0,
      amount,
    });
    if (insertError && insertError.code !== "23505") {
      throw new ApiError(insertError.message, 500);
    }

    const { data: events, error: eventsError } = await admin
      .from("run_points_events")
      .select("amount")
      .eq("run_id", run.id);
    if (eventsError) throw new ApiError(eventsError.message, 500);
    const pointsTotal = (events ?? []).reduce((sum, event) => sum + event.amount, 0);
    const { error: updateError } = await admin
      .from("runs")
      .update({ points_total: pointsTotal })
      .eq("id", run.id);
    if (updateError) throw new ApiError(updateError.message, 500);

    return NextResponse.json({
      amount: insertError ? 0 : amount,
      pointsTotal,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
