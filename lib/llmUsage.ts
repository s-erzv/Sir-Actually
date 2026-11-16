import { getAdminSupabase } from "@/lib/supabase/admin";

function token(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

/** Best-effort audit row; never break the LLM call because logging failed. */
export async function recordLlmUsage(input: {
  provider: string;
  model: string;
  route?: string;
  promptTokens?: unknown;
  completionTokens?: unknown;
  totalTokens?: unknown;
}): Promise<void> {
  try {
    const prompt = token(input.promptTokens);
    const completion = token(input.completionTokens);
    const total =
      token(input.totalTokens) ??
      (prompt !== null || completion !== null ? (prompt ?? 0) + (completion ?? 0) : null);

    await getAdminSupabase().from("llm_usage").insert({
      provider: input.provider,
      model: input.model,
      route: input.route ?? null,
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: total,
    });
  } catch (error) {
    console.error("[llm-usage]", error);
  }
}

let budgetCache = { checkedAt: 0, total: 0 };

/**
 * Optional hard stop. Set LLM_DAILY_TOKEN_BUDGET (tokens) to refuse new calls
 * once today's recorded usage reaches the cap. Checked at most once a minute.
 */
export async function assertDailyBudget(): Promise<void> {
  const budget = Number(process.env.LLM_DAILY_TOKEN_BUDGET ?? 0);
  if (!Number.isFinite(budget) || budget <= 0) return;

  const now = Date.now();
  if (now - budgetCache.checkedAt >= 60_000) {
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await getAdminSupabase()
        .from("llm_usage")
        .select("total_tokens")
        .gte("created_at", start.toISOString())
        .limit(20000);
      if (!error) {
        budgetCache = {
          checkedAt: now,
          total: (data ?? []).reduce(
            (sum, row) => sum + (row.total_tokens ?? 0),
            0,
          ),
        };
      }
    } catch {
      // Fail open when the audit table is unavailable.
      return;
    }
  }

  if (budgetCache.total >= budget) {
    throw new Error(
      `Batas token harian tercapai (${budgetCache.total}/${budget}). Naikkan LLM_DAILY_TOKEN_BUDGET atau tunggu besok.`,
    );
  }
}
