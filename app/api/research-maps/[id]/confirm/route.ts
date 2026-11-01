import { NextResponse, type NextRequest } from "next/server";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { checkCompleteness, COMPLETENESS_LABELS } from "@/lib/manuscript/completeness";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const { map, manuscript } = await loadOwnedResearchMap(id, user.id);
    const admin = getAdminSupabase();

    if (map.status === "confirmed") {
      const { data: existingJob } = await admin
        .from("recon_jobs")
        .select("id, status")
        .eq("research_map_id", id)
        .maybeSingle();
      return NextResponse.json({
        ok: true,
        alreadyConfirmed: true,
        reconJobId: existingJob?.id ?? null,
      });
    }

    const completeness = checkCompleteness({
      sourceText: map.source_text,
      stage: manuscript.stage,
      minReferences: manuscript.min_references,
    });

    const [{ count: citationCount }, { count: claimCount }] = await Promise.all([
      admin
        .from("citations")
        .select("id", { count: "exact", head: true })
        .eq("research_map_id", id)
        .eq("is_injected", false),
      admin
        .from("claims")
        .select("id", { count: "exact", head: true })
        .eq("research_map_id", id),
    ]);

    if (completeness.missing.length > 0 || (citationCount ?? 0) === 0 || (claimCount ?? 0) === 0) {
      return NextResponse.json(
        {
          error: "Research Map belum bisa dikonfirmasi.",
          missing: [
            ...completeness.missing.map((key) => COMPLETENESS_LABELS[key] ?? key),
            ...((claimCount ?? 0) === 0 ? ["Minimal satu klaim Research Map"] : []),
          ],
          completeness,
        },
        { status: 422 },
      );
    }

    const { error: completenessError } = await admin
      .from("research_maps")
      .update({ completeness })
      .eq("id", id);
    if (completenessError) throw new ApiError(completenessError.message, 500);

    const { error: confirmError } = await admin
      .from("research_maps")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", id);
    if (confirmError) throw new ApiError(confirmError.message, 500);

    const { data: job, error: jobError } = await admin
      .from("recon_jobs")
      .upsert(
        {
          research_map_id: id,
          status: "queued",
          step: "citations",
          steps_done: 0,
          steps_total: 3,
          cursor: {},
          timings: {},
          discarded: {},
          error: null,
        },
        { onConflict: "research_map_id" },
      )
      .select("id")
      .single();
    if (jobError || !job) throw new ApiError(jobError?.message ?? "Gagal membuat job Recon.", 500);

    return NextResponse.json({ ok: true, reconJobId: job.id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
