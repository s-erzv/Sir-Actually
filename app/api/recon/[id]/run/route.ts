import { NextResponse, type NextRequest, after } from "next/server";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { verifyCitations } from "@/lib/verify/citations";
import { detectCodeFindings } from "@/lib/recon/codeDetectors";
import { detectLlmFindings } from "@/lib/recon/llmDetector";
import { rankFindings } from "@/lib/recon/ranking";
import { getLLMProviderForAnalysis, hasRealLLM } from "@/lib/llm";
import { chunkManuscript } from "@/lib/manuscript/chunk";
import { sliceForDimensions } from "@/lib/recon/slices";
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
      const cursor = { ...(job.cursor as Record<string, unknown>) };

      // Reference checks hit Crossref/OpenAlex and need nothing from the
      // detectors, so they run alongside them instead of in front.
      const citationsTask = (async () => {
        if (typeof cursor.citations === "number") return;
        const t0 = Date.now();
        const { data: rows } = await admin
          .from("citations")
          .select("id, raw_text")
          .eq("research_map_id", map.id)
          .eq("is_injected", false);
        const list = rows ?? [];
        const results = await verifyCitations(list.map((row) => row.raw_text));
        await Promise.all(
          list.map((row, index) => {
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
        cursor.citations = list.length;
        timings.citations = Date.now() - t0;
      })();
      // A failed reference check must not leave an unhandled rejection while
      // the detectors are still running; it is re-thrown at the join below.
      citationsTask.catch(() => undefined);

      const [{ data: claimRows }, { data: citationRows }] = await Promise.all([
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
      ]);
      const claims = (claimRows ?? []).map((claim) => ({
        id: claim.id,
        kind: claim.kind,
        text: claim.text,
        sourceQuote: claim.source_quote,
      }));

      if (job.step !== "llm") {
        const t0 = Date.now();
        const codeFindings = detectCodeFindings(claims, manuscript.stage, map.source_text);
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
        timings.code = Date.now() - t0;
        cursor.code = codeFindings.length;
        // Checkpoint: a retry after an LLM failure must not insert these twice.
        nextJob = await advance(admin, id, { step: "llm", steps_done: 1, timings, cursor });
      }

      if (!hasRealLLM()) {
        throw new Error("LLM belum dikonfigurasi untuk tahap detektor LLM.");
      }
      const { data: existing } = await admin
        .from("findings")
        .select("weakness_type, evidence_quote")
        .eq("research_map_id", map.id);

      const llmStarted = Date.now();
      const slices = sliceForDimensions(chunkManuscript(map.source_text), claims);
      const sliceCount = Object.values(slices).reduce((sum, slice) => sum + slice.length, 0);
      const detected =
        sliceCount === 0
          ? { findings: [], promptVersion: "no_chunks", discarded: 0, failedDimensions: [], timings: {} }
          : await detectLlmFindings(getLLMProviderForAnalysis(), {
              claims,
              citations: (citationRows ?? []).map((citation) => citation.raw_text),
              chunks: [],
              dimensionChunks: Object.fromEntries(
                Object.entries(slices).map(([dimension, slice]) => [
                  dimension,
                  slice.map((chunk) => ({ section: chunk.sectionLabel, text: chunk.text })),
                ]),
              ),
              alreadyDetected: (existing ?? []).map((finding) => ({
                weaknessType: finding.weakness_type,
                evidenceQuote: finding.evidence_quote,
              })),
            });
      timings.llm = Date.now() - llmStarted;

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

      // Reference verification is a network-bound side quest. It must not
      // delay the player seeing their dungeon; finish it after the response.
      timings.total = Date.now() - started;

      const { data: doneJob } = await admin
        .from("recon_jobs")
        .update({
          status: "done",
          step: "done",
          steps_done: 3,
          timings: { ...timings, llm_by_dimension: detected.timings } as unknown as Json,
          discarded: {
            ...(job.discarded as Record<string, unknown>),
            llm_quotes: detected.discarded,
            llm_failed_dimensions: detected.failedDimensions,
            retrieval_insufficient: sliceCount === 0,
          } as Json,
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          cursor: { ...cursor, findings: ranked.length, retrieval_chunks: sliceCount } as Json,
        })
        .eq("id", id)
        .select("*")
        .single();
      nextJob = doneJob ?? nextJob;

      after(async () => {
        try {
          await citationsTask;
          await admin
            .from("recon_jobs")
            .update({
              cursor: {
                ...cursor,
                findings: ranked.length,
                retrieval_chunks: sliceCount,
              } as Json,
              timings: { ...timings } as Json,
            })
            .eq("id", id);
        } catch (error) {
          console.error("[recon citations]", error);
        }
      });
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
