import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/api/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { checkCompleteness, COMPLETENESS_LABELS } from "@/lib/manuscript/completeness";
import { classifyDocument, decideGate, needsClassification } from "@/lib/manuscript/documentGate";
import { extractResearchMap } from "@/lib/manuscript/researchMap";
import { chunkManuscript } from "@/lib/manuscript/chunk";
import { embedTexts } from "@/lib/embed";
import { getLLMProviderForExtraction, hasRealLLM } from "@/lib/llm";

export const maxDuration = 120;

const BODY_SCHEMA = z.object({
  title: z.string().trim().min(3).max(300),
  field: z.string().trim().max(200).optional().nullable(),
  language: z.enum(["id", "en"]).default("id"),
  stage: z.enum(["proposal", "skripsi", "jurnal"]),
  sourceText: z.string().min(300).max(800_000),
  /** Present when uploading a revised version of an existing manuscript. */
  manuscriptId: z.string().uuid().optional(),
  /** Player chose "tetap lanjut" after an unclear-document prompt. */
  confirmUnclear: z.boolean().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const body = BODY_SCHEMA.parse(await request.json());

    if (!hasRealLLM()) {
      throw new ApiError(
        "LLM belum dikonfigurasi. Isi OPENROUTER_API_KEY di .env.",
        503,
      );
    }

    const completeness = checkCompleteness({
      sourceText: body.sourceText,
      stage: body.stage,
    });
    const missing = completeness.missing.map((key) => COMPLETENESS_LABELS[key] ?? key);

    const provider = getLLMProviderForExtraction();

    // Missing sections never block; only a document that is not a paper does.
    const verdict = needsClassification(completeness.sectionsFound)
      ? await classifyDocument(provider, body.sourceText)
      : null;
    const gate = decideGate(completeness.sectionsFound, verdict);
    if (gate.action === "reject") {
      return NextResponse.json(
        {
          error: "Dokumen ini sepertinya bukan naskah karya ilmiah.",
          reason: gate.verdict.reason,
          missing,
        },
        { status: 422 },
      );
    }
    if (gate.action === "confirm" && !body.confirmUnclear) {
      return NextResponse.json(
        {
          error: "Dokumen ini kurang jelas sebagai naskah karya ilmiah.",
          needsConfirmation: true,
          reason: gate.verdict?.reason ?? "Struktur naskah sulit dikenali.",
          missing,
        },
        { status: 409 },
      );
    }
    const chunks = chunkManuscript(body.sourceText);

    // Extraction and embedding are independent; run them together so wall
    // time is the slower one, not the sum.
    const [mapResult, embedResult] = await Promise.allSettled([
      extractResearchMap(provider, body.sourceText),
      embedTexts(chunks.map((chunk) => chunk.text)),
    ]);
    if (mapResult.status === "rejected") throw mapResult.reason;
    const researchMap = mapResult.value;

    let embedding: { model: string; vectors: number[][] } | null = null;
    let embeddingWarning: string | null = null;
    if (embedResult.status === "fulfilled") {
      embedding = embedResult.value;
      if (embedding?.vectors.some((vector) => vector.length !== 768)) {
        embedding = null;
        embeddingWarning =
          "Dimensi embedding bukan 768; chunk disimpan tanpa vektor dan retrieval memakai FTS.";
      }
    } else {
      embeddingWarning =
        embedResult.reason instanceof Error
          ? embedResult.reason.message
          : "Embedding gagal; retrieval memakai FTS.";
      console.error("[embedding]", embedResult.reason);
    }

    const admin = getAdminSupabase();

    await admin.from("profiles").upsert(
      {
        id: user.id,
        display_name: user.email?.split("@")[0] ?? null,
      },
      { onConflict: "id" },
    );

    let manuscriptId: string;
    let mapVersion = 1;

    if (body.manuscriptId) {
      const { data: existing, error: existingError } = await admin
        .from("manuscripts")
        .select("id, owner_id, deleted_at")
        .eq("id", body.manuscriptId)
        .maybeSingle();
      if (existingError) throw new ApiError(existingError.message, 500);
      if (!existing) throw new ApiError("Naskah tidak ditemukan.", 404);
      if (existing.owner_id !== user.id) throw new ApiError("Akses ditolak.", 403);
      if (existing.deleted_at) throw new ApiError("Naskah sudah dihapus.", 410);
      manuscriptId = existing.id;

      const { error: updateError } = await admin
        .from("manuscripts")
        .update({
          title: body.title,
          field: body.field ?? null,
          language: body.language,
          stage: body.stage,
        })
        .eq("id", manuscriptId);
      if (updateError) throw new ApiError(updateError.message, 500);

      const { data: latest } = await admin
        .from("research_maps")
        .select("version")
        .eq("manuscript_id", manuscriptId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      mapVersion = (latest?.version ?? 0) + 1;
    } else {
      const { data: manuscript, error: manuscriptError } = await admin
        .from("manuscripts")
        .insert({
          owner_id: user.id,
          title: body.title,
          field: body.field ?? null,
          language: body.language,
          stage: body.stage,
        })
        .select("id")
        .single();

      if (manuscriptError || !manuscript) {
        throw new ApiError(manuscriptError?.message ?? "Gagal menyimpan naskah.", 500);
      }
      manuscriptId = manuscript.id;
    }

    const { data: map, error: mapError } = await admin
      .from("research_maps")
      .insert({
        manuscript_id: manuscriptId,
        version: mapVersion,
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
          manuscript_id: manuscriptId,
          version: mapVersion,
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
      manuscriptId,
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
