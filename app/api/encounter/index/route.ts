/**
 * POST /api/encounter/index — Mira's once-per-floor passive: reveal the
 * section label of the evidence quote (metadata only, not the answer).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { retrieveChunks } from "@/lib/rag/retrieve";
import type { RagRpcClient } from "@/lib/rag/types";

export const runtime = "nodejs";

const BODY = z.object({
  researchMapId: z.string().uuid(),
  evidenceQuote: z.string().max(4000),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const parsed = BODY.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Input tidak valid.", 400);
    }
    const { map } = await loadOwnedResearchMap(parsed.data.researchMapId, user.id);
    const admin = getAdminSupabase();

    const retrieval = await retrieveChunks(admin as unknown as RagRpcClient, {
      manuscriptId: map.manuscript_id,
      version: map.version,
      query: parsed.data.evidenceQuote || map.source_text.slice(0, 400),
      limit: 1,
    });
    const section = retrieval.chunks[0]?.sectionLabel ?? "tanpa bagian";

    return NextResponse.json({ section });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
