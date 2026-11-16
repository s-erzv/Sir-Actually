/**
 * /api/run/shop — the treasure chest behind a defeated boss.
 *
 * GET  ?runId           → coins, bag, HP and the price list
 * POST { runId, floor, item, purchaseId } → buy one potion
 *
 * `purchaseId` makes a purchase idempotent: a double tap is one purchase.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedActiveRun, loadWallet, syncCoins } from "@/lib/api/run";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { POTION_BAG_MAX, SHOP_ITEMS } from "@/lib/balance";
import { playerVitals } from "@/lib/combat/playerHp";
import { SHOP_ITEM_SLUGS, canBuy, type ShopItemSlug, type Wallet } from "@/lib/combat/shop";

export const runtime = "nodejs";

const BODY = z.object({
  runId: z.string().uuid(),
  floor: z.number().int().min(1).max(12),
  item: z.enum(SHOP_ITEM_SLUGS as [ShopItemSlug, ...ShopItemSlug[]]),
  purchaseId: z.string().uuid(),
});

function shopState(wallet: Wallet, storedHp: number, characterSlug: string | null) {
  return {
    coins: wallet.coins,
    potions: wallet.potions,
    bagMax: POTION_BAG_MAX,
    ...playerVitals(storedHp, characterSlug),
    items: SHOP_ITEM_SLUGS.map((slug) => ({ slug, ...SHOP_ITEMS[slug] })),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const runId = request.nextUrl.searchParams.get("runId");
    if (!runId) throw new ApiError("runId wajib diisi.", 400);
    const admin = getAdminSupabase();
    const run = await loadOwnedActiveRun(admin, runId, user.id);
    const wallet = await loadWallet(admin, run.id);
    return NextResponse.json(shopState(wallet, run.hearts_left, run.character_slug));
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

    // The chest only exists once this floor's boss has fallen.
    const { data: boss, error: bossError } = await admin
      .from("encounters")
      .select("id")
      .eq("run_id", run.id)
      .eq("floor_order", body.floor)
      .eq("is_boss", true)
      .eq("status", "won")
      .limit(1);
    if (bossError) throw new ApiError(bossError.message, 500);
    if (!boss || boss.length === 0) {
      throw new ApiError("Peti harta baru terbuka setelah boss lantai ini kalah.", 403);
    }

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
      const check = canBuy(await loadWallet(admin, run.id), body.item);
      if (!check.ok) throw new ApiError(check.reason, 409);

      const entry = SHOP_ITEMS[body.item];
      const { error: payError } = await admin.from("run_points_events").insert({
        run_id: run.id,
        kind: "shop",
        encounter_key: shopKey,
        seq: 0,
        amount: -entry.price,
      });
      if (payError && payError.code !== "23505") throw new ApiError(payError.message, 500);
      const { error: gainError } = await admin.from("run_points_events").insert({
        run_id: run.id,
        kind: "potion_gain",
        encounter_key: `${shopKey}:heal${entry.heal}`,
        seq: 0,
        amount: 0,
      });
      if (gainError && gainError.code !== "23505") throw new ApiError(gainError.message, 500);
    }

    const wallet = await loadWallet(admin, run.id);
    await syncCoins(admin, run.id, wallet);
    return NextResponse.json(shopState(wallet, run.hearts_left, run.character_slug));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
