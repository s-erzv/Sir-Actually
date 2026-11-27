/**
 * POST /api/run/loot — bank one collected loot pickup.
 * Amount is derived server-side; the stable loot key makes it idempotent.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { lootAmountForKey, lootKindForKey } from "@/lib/dungeon/loot";
import { walletFromEvents } from "@/lib/combat/shop";
import { POTION_BAG_MAX } from "@/lib/balance";
import { ITEMS } from "@/lib/combat/items";
import { lootSpotsForFloor } from "@/lib/dungeon/lootSpots";
import { buildFloorPlan, WEAKNESS_DIMENSION } from "@/game/map/buildFloorPlan";
import { generateFloorFromPlan } from "@/game/map/generateFloor";
import type { FindingStub, WeaknessType } from "@/lib/domain/types";

export const runtime = "nodejs";

const BODY = z.object({
  runId: z.string().uuid(),
  lootKey: z.string().min(3).max(120),
});

// Room loot `f2-r3:10,4` or dead-end loot `f2-nook:10,4`.
const LOOT_KEY = /^f(\d+)-(?:r\d+|nook):(\d+),(\d+)$/;
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

    const loadEvents = async () => {
      const { data, error: eventsError } = await admin
        .from("run_points_events")
        .select("kind, amount, encounter_key")
        .eq("run_id", run.id);
      if (eventsError) throw new ApiError(eventsError.message, 500);
      return data ?? [];
    };

    // A potion spot fills the bag; with a full bag it is worth points instead.
    const before = walletFromEvents(await loadEvents());
    const givesPotion =
      lootKindForKey(body.lootKey) === "potion" && before.potions.length < POTION_BAG_MAX;
    const amount = givesPotion ? 0 : lootAmountForKey(body.lootKey);

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
    const fresh = !insertError;

    if (fresh && givesPotion) {
      const { error: potionError } = await admin.from("run_points_events").insert({
        run_id: run.id,
        kind: "potion_gain",
        encounter_key: `${body.lootKey}:heal${ITEMS.potion_small.heal}`,
        seq: 0,
        amount: 0,
      });
      if (potionError && potionError.code !== "23505") {
        throw new ApiError(potionError.message, 500);
      }
    }

    const wallet = walletFromEvents(await loadEvents());
    const { error: updateError } = await admin
      .from("runs")
      .update({ points_total: wallet.coins })
      .eq("id", run.id);
    if (updateError) throw new ApiError(updateError.message, 500);

    return NextResponse.json({
      amount: fresh ? amount : 0,
      kind: fresh && givesPotion ? "potion" : "points",
      pointsTotal: wallet.coins,
      potions: wallet.potions.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
