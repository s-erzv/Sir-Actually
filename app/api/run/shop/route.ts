/**
 * /api/run/shop — the merchant who stands on every floor.
 *
 * GET  ?runId&floor     → coins, bag, HP, equipment and this floor's stock
 * POST { runId, floor, item, purchaseId } → buy one item. A potion goes in the
 *      bag; a weapon or armor is equipped at once and replaces the old one.
 *
 * `purchaseId` makes a purchase idempotent: a double tap is one purchase.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedActiveRun, loadWallet, syncCoins, type ActiveRun } from "@/lib/api/run";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { POTION_BAG_MAX } from "@/lib/balance";
import { playerVitals } from "@/lib/combat/playerHp";
import { getItem, stockForFloor } from "@/lib/combat/items";
import { EQUIP, SHOP_ITEM_SLUGS, canBuy, type ShopItemSlug, type Wallet } from "@/lib/combat/shop";

export const runtime = "nodejs";

const BODY = z.object({
  runId: z.string().uuid(),
  floor: z.number().int().min(1).max(12),
  item: z.enum(SHOP_ITEM_SLUGS as [ShopItemSlug, ...ShopItemSlug[]]),
  purchaseId: z.string().uuid(),
});

/** The merchant only trades on floors the run has reached. */
function assertFloorReached(run: ActiveRun, floor: number): void {
  if (floor > Math.max(1, run.current_floor ?? 1)) {
    throw new ApiError("Pedagang lantai itu belum kamu temui.", 403);
  }
}

function shopState(wallet: Wallet, run: ActiveRun, floor: number) {
  return {
    coins: wallet.coins,
    potions: wallet.potions.length,
    bagMax: POTION_BAG_MAX,
    weapon: wallet.weapon,
    armor: wallet.armor,
    ...playerVitals(run.hearts_left, run.character_slug),
    items: stockForFloor(floor),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const runId = request.nextUrl.searchParams.get("runId");
    if (!runId) throw new ApiError("runId wajib diisi.", 400);
    const floor = Math.max(1, Math.min(12, Number(request.nextUrl.searchParams.get("floor") ?? 1) || 1));
    const admin = getAdminSupabase();
    const run = await loadOwnedActiveRun(admin, runId, user.id);
    const wallet = await loadWallet(admin, run.id);
    return NextResponse.json(shopState(wallet, run, floor));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

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
    assertFloorReached(run, body.floor);

    const shopKey = `shop:${body.purchaseId}`;
    const { data: existing, error: existingError } = await admin
      .from("run_points_events")
      .select("id")
      .eq("run_id", run.id)
      .eq("kind", "shop")
      .eq("encounter_key", shopKey)
      .limit(1);
    if (existingError) throw new ApiError(existingError.message, 500);

    if (!existing || existing.length === 0) {
      const check = canBuy(await loadWallet(admin, run.id), body.item, body.floor);
      if (!check.ok) throw new ApiError(check.reason, 409);

      const item = getItem(body.item)!;
      const { error: payError } = await admin.from("run_points_events").insert({
        run_id: run.id,
        kind: "shop",
        encounter_key: shopKey,
        seq: 0,
        amount: -item.price,
      });
      if (payError && payError.code !== "23505") throw new ApiError(payError.message, 500);

      const { error: gainError } = await admin.from("run_points_events").insert(
        item.kind === "potion"
          ? { run_id: run.id, kind: "potion_gain", encounter_key: `${shopKey}:heal${item.heal}`, seq: 0, amount: 0 }
          : { run_id: run.id, kind: EQUIP, encounter_key: `equip:${body.purchaseId}:${item.slug}`, seq: 0, amount: 0 },
      );
      if (gainError && gainError.code !== "23505") throw new ApiError(gainError.message, 500);
    }

    const wallet = await loadWallet(admin, run.id);
    await syncCoins(admin, run.id, wallet);
    return NextResponse.json(shopState(wallet, run, body.floor));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
