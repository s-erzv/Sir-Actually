import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getCharacter, isCharacterUnlocked, isValidLoadout } from "@/lib/loadout";
import { currentProgress, isStaleRunProgress } from "@/lib/dungeon/runProgress";
import type { Database } from "@/lib/supabase/database";

import { playerHpMax, playerVitals } from "@/lib/combat/playerHp";
export const runtime = "nodejs";

const BODY = z.object({
  researchMapId: z.string().uuid(),
  characterSlug: z.string().min(1).max(40),
  weaponSlug: z.string().min(1).max(40),
  dungeonTitle: z.string().min(1).max(120).optional(),
  dungeonTier: z.string().min(1).max(40).optional(),
  floorCount: z.number().int().min(1).max(12).optional(),
});

type RunInsert = Database["public"]["Tables"]["runs"]["Insert"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const parsed = BODY.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Input tidak valid.", 400);
    }
    const body = parsed.data;
    const { map } = await loadOwnedResearchMap(body.researchMapId, user.id);
    if (!isValidLoadout(body.characterSlug, body.weaponSlug)) {
      throw new ApiError("Loadout tidak valid.", 400);
    }

    const admin = getAdminSupabase();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("unlocked_characters")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw new ApiError(profileError.message, 500);

    const character = getCharacter(body.characterSlug);
    if (!isCharacterUnlocked(body.characterSlug, profile?.unlocked_characters)) {
      throw new ApiError(
        `Karakter terkunci. Buka ${character?.name ?? "karakter"} dengan ${character?.unlockCost ?? 0} poin.`,
        403,
      );
    }

    const hpMax = playerHpMax(body.characterSlug);
    let { data: active, error: activeError } = await admin
      .from("runs")
      .select("id, points_total, hearts_left, current_floor, progress")
      .eq("research_map_id", map.id)
      .eq("status", "active")
      .maybeSingle();
    if (activeError) throw new ApiError(activeError.message, 500);

    // A run from an older floor layout cannot be resumed safely.
    if (active && isStaleRunProgress(active.progress)) {
      const { error: closeError } = await admin
        .from("runs")
        .update({ status: "finished", finished_at: new Date().toISOString() })
        .eq("id", active.id);
      if (closeError) throw new ApiError(closeError.message, 500);
      active = null;
    }

    if (active) {
      const { error } = await admin
        .from("runs")
        .update({
          character_slug: body.characterSlug,
          weapon_slug: body.weaponSlug,
          // A resumed run keeps its HP, capped to the chosen character's maximum.
          hearts_left: Math.min(active.hearts_left, hpMax),
          dungeon_title: body.dungeonTitle ?? null,
          dungeon_tier: body.dungeonTier ?? null,
          floor_count: body.floorCount ?? null,
        })
        .eq("id", active.id);
      if (error) throw new ApiError(error.message, 500);
      return NextResponse.json({
        runId: active.id,
        pointsTotal: active.points_total ?? 0,
        ...playerVitals(active.hearts_left, body.characterSlug),
        currentFloor: active.current_floor ?? 1,
        progress: active.progress ?? {},
        resumed: true,
      });
    }

    const insert: RunInsert = {
      research_map_id: map.id,
      examiner_style: "detail",
      status: "active",
      hearts_left: hpMax,
      rubric_version: "rubrics_v1",
      model_version: process.env.LLM_MODEL ?? "kagiro",
      character_slug: body.characterSlug,
      weapon_slug: body.weaponSlug,
      dungeon_title: body.dungeonTitle ?? null,
      dungeon_tier: body.dungeonTier ?? null,
      floor_count: body.floorCount ?? null,
      current_floor: 1,
      progress: currentProgress([]),
    };
    const { data: run, error } = await admin.from("runs").insert(insert).select("id").single();
    if (error?.code === "23505") {
      // Another request created the active run first.
      const { data: raced } = await admin
        .from("runs")
        .select("id, points_total, hearts_left, current_floor")
        .eq("research_map_id", map.id)
        .eq("status", "active")
        .maybeSingle();
      if (raced) {
        return NextResponse.json({
          runId: raced.id,
          pointsTotal: raced.points_total ?? 0,
          ...playerVitals(raced.hearts_left, body.characterSlug),
          currentFloor: raced.current_floor ?? 1,
          resumed: true,
        });
      }
    }
    if (error) throw new ApiError(error.message, 500);
    if (!run) throw new ApiError("Gagal membuat run.", 500);

    return NextResponse.json({
      runId: run.id,
      pointsTotal: 0,
      ...playerVitals(hpMax, body.characterSlug),
      resumed: false,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
