/**
 * POST /api/run/potion { runId, requestId } — drink the oldest potion in the bag.
 * `requestId` makes one tap one potion.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedActiveRun, loadWallet } from "@/lib/api/run";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { playerVitals } from "@/lib/combat/playerHp";
import { healedHp } from "@/lib/combat/shop";

export const runtime = "nodejs";

const BODY = z.object({ runId: z.string().uuid(), requestId: z.string().uuid() });

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const parsed = BODY.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Input tidak valid.", 400);
    }
    const body = parsed.data;
    const admin = getAdminSupabase();
    const run = await loadOwnedActiveRun(admin, body.runId, user.id);
    const vitals = playerVitals(run.hearts_left, run.character_slug);
    const wallet = await loadWallet(admin, run.id);

    const heal = wallet.potions[0];
    if (heal === undefined) throw new ApiError("Tas ramuanmu kosong.", 409);
    if (vitals.hp >= vitals.hpMax) throw new ApiError("HP-mu sudah penuh.", 409);

    const { error: useError } = await admin.from("run_points_events").insert({
      run_id: run.id,
      kind: "potion_use",
      encounter_key: `use:${body.requestId}`,
      seq: 0,
      amount: 0,
    });
    if (useError?.code === "23505") {
      // Same tap delivered twice: the potion is already drunk.
      return NextResponse.json({ ...vitals, potions: wallet.potions.length, healed: 0 });
    }
    if (useError) throw new ApiError(useError.message, 500);

    const hp = healedHp(vitals.hp, vitals.hpMax, heal);
    const { error: hpError } = await admin.from("runs").update({ hearts_left: hp }).eq("id", run.id);
    if (hpError) throw new ApiError(hpError.message, 500);

    return NextResponse.json({
      ...playerVitals(hp, run.character_slug),
      potions: wallet.potions.length - 1,
      healed: hp - vitals.hp,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
