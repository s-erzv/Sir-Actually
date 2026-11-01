import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database";

const BODY = z.object({
  runId: z.string().uuid(),
  currentFloor: z.number().int().min(1).max(12),
  resolvedKeys: z.array(z.string().max(120)).max(300).default([]),
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

    const progress = {
      resolved: [...new Set(body.resolvedKeys)].sort(),
    } satisfies Record<string, string[]>;

    const { error: updateError } = await admin
      .from("runs")
      .update({
        current_floor: body.currentFloor,
        progress: progress as unknown as Json,
      })
      .eq("id", run.id);
    if (updateError) throw new ApiError(updateError.message, 500);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
