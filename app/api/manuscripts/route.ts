import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/api/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { checkCompleteness, COMPLETENESS_LABELS } from "@/lib/manuscript/completeness";
import { extractResearchMap } from "@/lib/manuscript/researchMap";
import { chunkManuscript } from "@/lib/manuscript/chunk";
import { embedTexts } from "@/lib/embed";
import { getLLMProvider, hasRealLLM } from "@/lib/llm";

export const maxDuration = 120;

const BODY_SCHEMA = z.object({
  title: z.string().trim().min(3).max(300),
  field: z.string().trim().max(200).optional().nullable(),
  language: z.enum(["id", "en"]).default("id"),
  stage: z.enum(["proposal", "skripsi", "jurnal"]),
  minReferences: z.number().int().min(1).max(500).nullable(),
  sourceText: z.string().min(300).max(800_000),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const body = BODY_SCHEMA.parse(await request.json());

    if (!hasRealLLM()) {
      throw new ApiError(
        "LLM belum dikonfigurasi. Isi LLM_PROVIDER, LLM_MODEL, dan LLM_API_KEY di .env.local.",
        503,
      );
    }

    const completeness = checkCompleteness({
      sourceText: body.sourceText,
      stage: body.stage,
      minReferences: body.minReferences,
    });

    if (!completeness.complete) {
      const missing = completeness.missing.map((key) => COMPLETENESS_LABELS[key] ?? key);
      return NextResponse.json(
        {
          error: "Naskah belum lengkap. Lengkapi bagian yang kurang lalu unggah ulang.",
          completeness,
          missing,
        },
        { status: 422 },
      );
    }

    const provider = getLLMProvider();
    const researchMap = await extractResearchMap(provider, body.sourceText);
    const chunks = chunkManuscript(body.sourceText);

    let embedding: { model: string; vectors: number[][] } | null = null;
    let embeddingWarning: string | null = null;
    try {
      embedding = await embedTexts(chunks.map((chunk) => chunk.text));
      if (embedding?.vectors.some((vector) => vector.length !== 768)) {
        embedding = null;
        embeddingWarning =
          "Dimensi embedding bukan 768; chunk disimpan tanpa vektor dan retrieval memakai FTS.";
      }
    } catch (error) {
      embeddingWarning =
        error instanceof Error ? error.message : "Embedding gagal; retrieval memakai FTS.";
      console.error("[embedding]", error);
    }

    const admin = getAdminSupabase();

    await admin.from("profiles").upsert(
      {
        id: user.id,
        display_name: user.email?.split("@")[0] ?? null,
      },
      { onConflict: "id" },
    );

    const { data: manuscript, error: manuscriptError } = await admin
      .from("manuscripts")
      .insert({
        owner_id: user.id,
        title: body.title,
        field: body.field ?? null,
        language: body.language,
        stage: body.stage,
        min_references: body.minReferences,
      })
      .select("id")
      .single();

    if (manuscriptError || !manuscript) {
      throw new ApiError(manuscriptError?.message ?? "Gagal menyimpan naskah.", 500);
    }

    const { data: map, error: mapError } = await admin
      .from("research_maps")
      .insert({
        manuscript_id: manuscript.id,
        version: 1,
        status: "draft",
        source_text: body.sourceText,
        completeness,
      })
      .select("id")
      .single();

    if (mapError || !map) {
      throw new ApiError(mapError?.message ?? "Gagal menyimpan Research Map.", 500);
    }

    if (researchMap.claims.length > 0) {
      const { error } = await admin.from("claims").insert(
        researchMap.claims.map((claim) => ({
          research_map_id: map.id,
          kind: claim.kind,
          text: claim.text,
          source_quote: claim.sourceQuote,
          position: claim.position,
        })),
      );
      if (error) throw new ApiError(error.message, 500);
    }

    if (researchMap.citations.length > 0) {
      const { error } = await admin.from("citations").insert(
        researchMap.citations.map((rawText) => ({
          research_map_id: map.id,
          raw_text: rawText,
          verification_status: "unchecked" as const,
          parsed: { raw_text: rawText },
        })),
      );
      if (error) throw new ApiError(error.message, 500);
    }

    if (chunks.length > 0) {
      const { error } = await admin.from("manuscript_chunks").insert(
        chunks.map((chunk) => ({
          manuscript_id: manuscript.id,
          version: 1,
          chunk_index: chunk.chunkIndex,
          section_label: chunk.sectionLabel,
          char_start: chunk.charStart,
          char_end: chunk.charEnd,
          text: chunk.text,
          embedding: embedding?.vectors[chunk.chunkIndex] ?? null,
          embedding_model: embedding?.model ?? null,
        })),
      );
      if (error) console.error("[chunks]", error);
    }

    // The map is locked automatically: the player reviews nothing, they play.
    const { error: confirmError } = await admin
      .from("research_maps")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", map.id);
    if (confirmError) throw new ApiError(confirmError.message, 500);

    const { data: reconJob, error: reconError } = await admin
      .from("recon_jobs")
      .upsert(
        {
          research_map_id: map.id,
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
    if (reconError || !reconJob) {
      throw new ApiError(reconError?.message ?? "Gagal memulai Recon.", 500);
    }

    return NextResponse.json({
      manuscriptId: manuscript.id,
      researchMapId: map.id,
      reconJobId: reconJob.id,
      completeness,
      claimCount: researchMap.claims.length,
      citationCount: researchMap.citations.length,
      chunkCount: chunks.length,
      discardedQuotes: researchMap.discardedQuotes,
      embeddingWarning,
      llm: { provider: provider.providerName, model: provider.modelName },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }
    return apiErrorResponse(error);
  }
}
