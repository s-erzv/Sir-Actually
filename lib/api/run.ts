import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { walletFromEvents, type Wallet } from "@/lib/combat/shop";
import type { Database } from "@/lib/supabase/database";

type Admin = SupabaseClient<Database>;

export interface ActiveRun {
  id: string;
  research_map_id: string;
  hearts_left: number;
  character_slug: string | null;
}

/** The caller's active run, or a 404. Ownership is checked through the map. */
export async function loadOwnedActiveRun(
  admin: Admin,
  runId: string,
  userId: string,
): Promise<ActiveRun> {
  const { data: run, error } = await admin
    .from("runs")
    .select("id, research_map_id, status, hearts_left, character_slug")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw new ApiError(error.message, 500);
  if (!run || run.status !== "active") throw new ApiError("Run aktif tidak ditemukan.", 404);
  await loadOwnedResearchMap(run.research_map_id, userId);
  return run;
}

export async function loadWallet(admin: Admin, runId: string): Promise<Wallet> {
  const { data, error } = await admin
    .from("run_points_events")
    .select("kind, amount, encounter_key")
    .eq("run_id", runId);
  if (error) throw new ApiError(error.message, 500);
  return walletFromEvents(data ?? []);
}

/** Keep the denormalised coin total on the run in step with its events. */
export async function syncCoins(admin: Admin, runId: string, wallet: Wallet): Promise<void> {
  const { error } = await admin.from("runs").update({ points_total: wallet.coins }).eq("id", runId);
  if (error) throw new ApiError(error.message, 500);
}
