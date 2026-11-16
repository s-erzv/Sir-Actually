/**
 * POST /api/ghost/challenge — ensure this research map has one injected fake
 * reference and return a shuffled shortlist for the library UI.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getLLMProviderForExtraction } from "@/lib/llm";
import { generateGhostCitation } from "@/lib/ghost/generate";
import type { Json } from "@/lib/supabase/database";

export const runtime = "nodejs";
export const maxDuration = 120;

const BODY = z.object({ runId: z.string().uuid() });
const SHORTLIST_SIZE = 8;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffled<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = seed || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822519);
    const pick = (state >>> 0) % (index + 1);
    [result[index], result[pick]] = [result[pick]!, result[index]!];
  }
  return result;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const parsed = BODY.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Input tidak valid.", 400);
    }

    const admin = getAdminSupabase();
    const { data: run, error: runError } = await admin
      .from("runs")
      .select("id, research_map_id, status")
      .eq("id", parsed.data.runId)
      .maybeSingle();
    if (runError) throw new ApiError(runError.message, 500);
    if (!run || run.status !== "active") throw new ApiError("Run aktif tidak ditemukan.", 404);
    const { map } = await loadOwnedResearchMap(run.research_map_id, user.id);

    const { data: existingCheck } = await admin
      .from("ghost_checks")
      .select("hit")
      .eq("run_id", run.id)
      .maybeSingle();
    if (existingCheck) {
      return NextResponse.json({ done: true, hit: existingCheck.hit });
    }

    const { data: realCitations, error: citationsError } = await admin
      .from("citations")
      .select("id, raw_text")
      .eq("research_map_id", map.id)
      .eq("is_injected", false);
    if (citationsError) throw new ApiError(citationsError.message, 500);
    if ((realCitations ?? []).length === 0) {
      return NextResponse.json({ done: true, hit: false, noCitations: true });
    }

    let { data: injected } = await admin
      .from("citations")
      .select("id, raw_text")
      .eq("research_map_id", map.id)
      .eq("is_injected", true)
      .maybeSingle();

    if (!injected) {
      const raw = await generateGhostCitation(
        getLLMProviderForExtraction(),
        (realCitations ?? []).map((citation) => citation.raw_text),
        hashString(`${run.id}:${map.id}`),
      );
      const { data: created, error: insertError } = await admin
        .from("citations")
        .insert({
          research_map_id: map.id,
          raw_text: raw,
          parsed: { raw_text: raw, source: "ghost" } as unknown as Json,
          verification_status: "needs_review",
          is_injected: true,
        })
        .select("id, raw_text")
        .single();
      if (insertError && insertError.code !== "23505") {
        throw new ApiError(insertError.message, 500);
      }
      if (created) {
        injected = created;
      } else {
        const { data: raced } = await admin
          .from("citations")
          .select("id, raw_text")
          .eq("research_map_id", map.id)
          .eq("is_injected", true)
          .maybeSingle();
        injected = raced;
      }
    }

    if (!injected) throw new ApiError("Referensi palsu tidak dapat dibuat.", 500);

    const reals = shuffled(realCitations ?? [], hashString(run.id)).slice(
      0,
      SHORTLIST_SIZE - 1,
    );
    const shortlist = shuffled([...reals, injected], hashString(`${run.id}:ghost`));

    return NextResponse.json({
      done: false,
      citations: shortlist.map((citation) => ({
        id: citation.id,
        rawText: citation.raw_text,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
