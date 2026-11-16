import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse, requireUser } from "@/lib/api/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireUser(request);
    const days = Math.min(90, Math.max(1, Number(request.nextUrl.searchParams.get("days") ?? 30)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const admin = getAdminSupabase();

    const { data, error } = await admin
      .from("llm_usage")
      .select("provider, model, prompt_tokens, completion_tokens, total_tokens, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20000);
    if (error) throw new Error(error.message);

    const daysMap = new Map<string, number>();
    const modelsMap = new Map<string, { prompt: number; completion: number; total: number }>();
    let prompt = 0;
    let completion = 0;
    let total = 0;

    for (const row of data ?? []) {
      const promptTokens = row.prompt_tokens ?? 0;
      const completionTokens = row.completion_tokens ?? 0;
      const totalTokens = row.total_tokens ?? promptTokens + completionTokens;
      prompt += promptTokens;
      completion += completionTokens;
      total += totalTokens;

      const day = row.created_at.slice(0, 10);
      daysMap.set(day, (daysMap.get(day) ?? 0) + totalTokens);

      const key = `${row.provider}/${row.model}`;
      const model = modelsMap.get(key) ?? { prompt: 0, completion: 0, total: 0 };
      model.prompt += promptTokens;
      model.completion += completionTokens;
      model.total += totalTokens;
      modelsMap.set(key, model);
    }

    return NextResponse.json({
      since,
      days,
      calls: data?.length ?? 0,
      totals: { prompt, completion, total },
      byModel: [...modelsMap.entries()].map(([model, value]) => ({ model, ...value })),
      byDay: [...daysMap.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([day, tokens]) => ({ day, tokens })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
