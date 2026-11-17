/**
 * Server side of a dweller: which Research Map claim does the dweller in
 * (floor, room) ask about? Resolved from the database, never from the client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/auth";
import { WEAKNESS_DIMENSION, buildFloorPlan } from "@/game/map/buildFloorPlan";
import type { FindingStub, FloorPlan, WeaknessType } from "@/lib/domain/types";
import { DWELLER_ROOM_BASE, dwellerCount, eligibleClaims } from "./dwellers";

type Admin = SupabaseClient;

const KNOWN_TYPES = new Set(Object.keys(WEAKNESS_DIMENSION));

export interface DwellerClaim {
  kind: string;
  text: string;
  sourceQuote: string;
  /** Boss slug of the floor the dweller lives on. */
  floorBossSlug: string;
  dimension: string;
}

interface ClaimRow {
  kind: string;
  text: string;
  source_quote: string | null;
}

export async function loadFloorPlans(admin: Admin, researchMapId: string): Promise<FloorPlan[]> {
  const [{ data: findings, error: findingsError }, { count: citationCount, error: citationsError }] =
    await Promise.all([
      admin
        .from("findings")
        .select("id, weakness_type, severity, centrality, confidence, evidence_quote, rank")
        .eq("research_map_id", researchMapId),
      admin
        .from("citations")
        .select("id", { count: "exact", head: true })
        .eq("research_map_id", researchMapId)
        .eq("is_injected", false),
    ]);
  if (findingsError) throw new ApiError(findingsError.message, 500);
  if (citationsError) throw new ApiError(citationsError.message, 500);

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
  return buildFloorPlan(stubs, (citationCount ?? 0) > 0);
}

async function loadClaims(admin: Admin, researchMapId: string): Promise<ClaimRow[]> {
  const { data, error } = await admin
    .from("claims")
    .select("kind, text, source_quote, position")
    .eq("research_map_id", researchMapId)
    .order("position");
  if (error) throw new ApiError(error.message, 500);
  return data ?? [];
}

/** Dwellers per floor order, for the client to place on each map. */
export async function dwellerCountsByFloor(
  admin: Admin,
  researchMapId: string,
  plans: readonly FloorPlan[],
): Promise<Record<number, number>> {
  const claims = await loadClaims(admin, researchMapId);
  return Object.fromEntries(
    plans.map((plan) => [
      plan.floorOrder,
      dwellerCount({
        floorOrder: plan.floorOrder,
        dimension: plan.dimension,
        findingCount: plan.findingIds.length,
        claimCount: eligibleClaims(claims, plan.dimension).length,
      }),
    ]),
  );
}

/**
 * The claim behind one dweller. Throws 404 when that floor has no such
 * dweller, so a client cannot conjure extra ones.
 */
export async function resolveDwellerClaim(
  admin: Admin,
  researchMapId: string,
  floorOrder: number,
  roomOrder: number,
): Promise<DwellerClaim> {
  const plans = await loadFloorPlans(admin, researchMapId);
  const plan = plans.find((floor) => floor.floorOrder === floorOrder);
  if (!plan) throw new ApiError("Lantai tidak ditemukan.", 404);

  const eligible = eligibleClaims(await loadClaims(admin, researchMapId), plan.dimension);
  const count = dwellerCount({
    floorOrder,
    dimension: plan.dimension,
    findingCount: plan.findingIds.length,
    claimCount: eligible.length,
  });
  const index = roomOrder - DWELLER_ROOM_BASE;
  if (index < 0 || index >= count) throw new ApiError("Penghuni tidak ditemukan di lantai ini.", 404);

  // Spread across the floor's claims instead of always asking the first ones.
  const claim = eligible[(index * Math.max(1, Math.floor(eligible.length / count))) % eligible.length]!;
  return {
    kind: claim.kind,
    text: claim.text,
    sourceQuote: (claim.source_quote ?? "").trim(),
    floorBossSlug: plan.bossSlug,
    dimension: plan.dimension,
  };
}
