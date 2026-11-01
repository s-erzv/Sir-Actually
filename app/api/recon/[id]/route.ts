import { NextResponse, type NextRequest } from "next/server";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const admin = getAdminSupabase();

    const { data: job, error } = await admin
      .from("recon_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new ApiError(error.message, 500);
    if (!job) throw new ApiError("Job Recon tidak ditemukan.", 404);

    const { data: map } = await admin
      .from("research_maps")
      .select("id, manuscript_id, status")
      .eq("id", job.research_map_id)
      .maybeSingle();
    if (!map) throw new ApiError("Research Map tidak ditemukan.", 404);

    const { data: manuscript } = await admin
      .from("manuscripts")
      .select("owner_id")
      .eq("id", map.manuscript_id)
      .maybeSingle();
    if (!manuscript || manuscript.owner_id !== user.id) {
      throw new ApiError("Akses ditolak.", 403);
    }

    const { data: findings } = await admin
      .from("findings")
      .select(
        "id, weakness_type, claim_id, severity, severity_source, centrality, confidence, detector, evidence_quote, status, rank, version, created_at",
      )
      .eq("research_map_id", map.id)
      .order("rank", { ascending: true, nullsFirst: false });

    return NextResponse.json({
      job,
      map,
      findings: findings ?? [],
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
