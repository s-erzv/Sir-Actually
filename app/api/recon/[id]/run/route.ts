import { NextResponse, type NextRequest } from "next/server";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { verifyCitations } from "@/lib/verify/citations";
import { detectCodeFindings } from "@/lib/recon/codeDetectors";
import { detectLlmFindings } from "@/lib/recon/llmDetector";
import { rankFindings } from "@/lib/recon/ranking";
import { getLLMProvider, hasRealLLM } from "@/lib/llm";
import type { Database, Json } from "@/lib/supabase/database";

export const maxDuration = 120;

type JobRow = Database["public"]["Tables"]["recon_jobs"]["Row"];

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const admin = getAdminSupabase();

    const { data: job, error: jobError } = await admin
      .from("recon_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (jobError) throw new ApiError(jobError.message, 500);
    if (!job) throw new ApiError("Job Recon tidak ditemukan.", 404);

    const { data: map, error: mapError } = await admin
      .from("research_maps")
      .select("*")
      .eq("id", job.research_map_id)
      .maybeSingle();
    if (mapError) throw new ApiError(mapError.message, 500);
    if (!map) throw new ApiError("Research Map tidak ditemukan.", 404);

    const { data: manuscript, error: manuscriptError } = await admin
      .from("manuscripts")
      .select("*")
      .eq("id", map.manuscript_id)
      .maybeSingle();
    if (manuscriptError) throw new ApiError(manuscriptError.message, 500);
    if (!manuscript || manuscript.owner_id !== user.id) {
      throw new ApiError("Akses ditolak.", 403);
    }
    if (map.status !== "confirmed") {
      throw new ApiError("Research Map belum dikonfirmasi.", 409);
    }
    if (job.status === "done") {
      return NextResponse.json({ job, done: true });
    }

    await admin
      .from("recon_jobs")
      .update({
        status: "running",
        started_at: job.started_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", id);

    const timings = { ...(job.timings as Record<string, number>) };
    let nextJob: JobRow = { ...job, status: "running" };
    const started = Date.now();

    try {
      if (job.step === "citations" || !job.step) {
        const { data: citations } = await admin
          .from("citations")
          .select("id, raw_text")
          .eq("research_map_id", map.id)
          .eq("is_injected", false);

        const rows = citations ?? [];
        const results = await verifyCitations(rows.map((row) => row.raw_text));
        await Promise.all(
          rows.map((row, index) => {
            const result = results[index];
            if (!result) return Promise.resolve();
            return admin
              .from("citations")
              .update({
                verification_status: result.status,
                matched_work: result.matchedWork as Json,
                verified_at: new Date().toISOString(),
              })
              .eq("id", row.id);
          }),
        );

        timings.citations = Date.now() - started;
        nextJob = await advance(admin, id, {
          step: "code",
          steps_done: 1,
          timings,
          cursor: { ...(job.cursor as Record<string, unknown>), citations: rows.length },
        });
      } else if (job.step === "code") {
        const { data: claims } = await admin
          .from("claims")
          .select("id, kind, text, source_quote")
          .eq("research_map_id", map.id)
          .order("position");

        const codeFindings = detectCodeFindings(
          (claims ?? []).map((claim) => ({
            id: claim.id,
            kind: claim.kind,
            text: claim.text,
            sourceQuote: claim.source_quote,
          })),
          manuscript.stage,
          map.source_text,
        );
        if (codeFindings.length > 0) {
          const { error } = await admin.from("findings").insert(
            codeFindings.map((finding) => ({
              research_map_id: map.id,
              weakness_type: finding.weaknessType,
              claim_id: finding.claimId,
              severity: finding.severity,
              severity_source: "default" as const,
              centrality: finding.centrality,
              confidence: finding.confidence,
              detector: "code" as const,
              evidence_quote: finding.evidenceQuote,
              version: "code_v1",
            })),
          );
          if (error) throw new Error(error.message);
        }

        timings.code = Date.now() - started;
        nextJob = await advance(admin, id, {
          step: "llm",
          steps_done: 2,
          timings,
          cursor: { ...(job.cursor as Record<string, unknown>), code: codeFindings.length },
        });
      } else {
        if (!hasRealLLM()) {
          throw new Error("LLM belum dikonfigurasi untuk tahap detektor LLM.");
        }
        const [{ data: claims }, { data: citations }, { data: chunks }, { data: existing }] =
          await Promise.all([
            admin
              .from("claims")
              .select("id, kind, text, source_quote")
              .eq("research_map_id", map.id)
              .order("position"),
            admin
              .from("citations")
              .select("raw_text")
              .eq("research_map_id", map.id)
              .eq("is_injected", false),
            admin
              .from("manuscript_chunks")
              .select("section_label, text")
              .eq("manuscript_id", manuscript.id)
              .eq("version", map.version)
              .order("chunk_index")
              .limit(24),
            admin
              .from("findings")
              .select("weakness_type, evidence_quote")
              .eq("research_map_id", map.id),
          ]);

        const detected = await detectLlmFindings(getLLMProvider(), {
          claims: (claims ?? []).map((claim) => ({
            id: claim.id,
            kind: claim.kind,
            text: claim.text,
            sourceQuote: claim.source_quote,
          })),
          citations: (citations ?? []).map((citation) => citation.raw_text),
          chunks: (chunks ?? []).map((chunk) => ({
            section: chunk.section_label,
            text: chunk.text,
          })),
          alreadyDetected: (existing ?? []).map((finding) => ({
            weaknessType: finding.weakness_type,
            evidenceQuote: finding.evidence_quote,
          })),
          sourceText: map.source_text,
        });

        if (detected.findings.length > 0) {
          const { error } = await admin.from("findings").insert(
            detected.findings.map((finding) => ({
              research_map_id: map.id,
              weakness_type: finding.weaknessType,
              claim_id: finding.claimId,
              severity: finding.severity,
              severity_source: "llm" as const,
              centrality: finding.centrality,
              confidence: finding.confidence,
              detector: "llm" as const,
              evidence_quote: finding.evidenceQuote,
              version: detected.promptVersion,
            })),
          );
          if (error) throw new Error(error.message);
        }

        const { data: allFindings } = await admin
          .from("findings")
          .select("id, severity, centrality, confidence")
          .eq("research_map_id", map.id);
        const ranked = rankFindings(allFindings ?? []);
        await Promise.all(
          ranked.map((finding) =>
            admin.from("findings").update({ rank: finding.rank }).eq("id", finding.id),
          ),
        );

        timings.llm = Date.now() - started;
        const discarded = {
          ...(job.discarded as Record<string, unknown>),
          llm_quotes: detected.discarded,
        };
        const { data: doneJob } = await admin
          .from("recon_jobs")
          .update({
            status: "done",
            step: "done",
            steps_done: 3,
            timings,
            discarded,
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            cursor: {
              ...(job.cursor as Record<string, unknown>),
              findings: ranked.length,
            },
          })
          .eq("id", id)
          .select("*")
          .single();
        nextJob = doneJob ?? nextJob;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Recon gagal.";
      await admin
        .from("recon_jobs")
        .update({
          status: "failed",
          error: message,
          timings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      throw error;
    }

    return NextResponse.json({ job: nextJob, done: nextJob.status === "done" });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function advance(
  admin: ReturnType<typeof getAdminSupabase>,
  id: string,
  patch: {
    step: string;
    steps_done: number;
    timings: Record<string, number>;
    cursor: Record<string, unknown>;
  },
): Promise<JobRow> {
  const { data, error } = await admin
    .from("recon_jobs")
    .update({
      ...patch,
      cursor: patch.cursor as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Gagal memperbarui job Recon.");
  return data;
}
