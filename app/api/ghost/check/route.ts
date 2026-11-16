/**
 * POST /api/ghost/check — record which reference the player flagged.
 * No Heart is lost either way; real references are never a "fake citation".
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BODY = z.object({
  runId: z.string().uuid(),
  citationId: z.string().uuid(),
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
});

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
    await loadOwnedResearchMap(run.research_map_id, user.id);

    const { data: existing } = await admin
      .from("ghost_checks")
      .select("hit")
      .eq("run_id", run.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ alreadyChecked: true, hit: existing.hit });
    }

    const { data: citations, error: citationError } = await admin
      .from("citations")
      .select("id, raw_text, is_injected")
      .eq("research_map_id", run.research_map_id);
    if (citationError) throw new ApiError(citationError.message, 500);

    const flagged = (citations ?? []).find((citation) => citation.id === body.citationId);
    if (!flagged) throw new ApiError("Referensi tidak ditemukan.", 404);
    const fake = (citations ?? []).find((citation) => citation.is_injected) ?? null;
    const hit = flagged.is_injected;

    const { error: insertError } = await admin.from("ghost_checks").insert({
      run_id: run.id,
      citation_id: flagged.id,
      flagged_citation_ids: [flagged.id],
      hit,
      duration_ms: body.durationMs ?? null,
    });
    if (insertError && insertError.code !== "23505") {
      throw new ApiError(insertError.message, 500);
    }

    return NextResponse.json({
      hit,
      fakeRawText: hit ? null : (fake?.raw_text ?? null),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
