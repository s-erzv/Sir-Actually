/**
 * Live Recon timing on a real manuscript from the database. Skipped unless
 * RUN_LLM_EVAL=1. Prints timings and findings; asserts only the speed budget.
 */
import { describe, expect, it } from "vitest";

const live = process.env.RUN_LLM_EVAL === "1";
if (live) process.loadEnvFile(".env.local");

describe.skipIf(!live)("Recon (LLM nyata)", () => {
  it("empat spesialis selesai di bawah 45 detik", async () => {
    const { getAdminSupabase } = await import("@/lib/supabase/admin");
    const { getLLMProviderForAnalysis } = await import("@/lib/llm");
    const { chunkManuscript } = await import("@/lib/manuscript/chunk");
    const { sliceForDimensions } = await import("./slices");
    const { detectLlmFindings } = await import("./llmDetector");
    const { extractResearchMap } = await import("@/lib/manuscript/researchMap");
    const admin = getAdminSupabase();

    const { data: map } = await admin
      .from("research_maps")
      .select("id, source_text")
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!map) throw new Error("Tidak ada Research Map confirmed.");
    const { data: claims } = await admin
      .from("claims")
      .select("id, kind, text, source_quote")
      .eq("research_map_id", map.id)
      .order("position");
    const { data: citations } = await admin
      .from("citations")
      .select("raw_text")
      .eq("research_map_id", map.id)
      .eq("is_injected", false);

    console.log(`naskah ${map.source_text.length} karakter, ${claims?.length} klaim`);
    const provider = getLLMProviderForAnalysis();

    if (process.env.EVAL_EXTRACT === "1") {
      const t0 = Date.now();
      const extraction = await extractResearchMap(provider, map.source_text);
      console.log(
        `ekstraksi ${Date.now() - t0} ms -> ${extraction.claims.length} klaim, ${extraction.discardedQuotes} kutipan dibuang`,
      );
      console.log(extraction.claims.map((claim) => `  (${claim.kind}) ${claim.text.slice(0, 110)}`).join("\n"));
    }

    const slices = sliceForDimensions(
      chunkManuscript(map.source_text),
      (claims ?? []).map((claim) => ({ kind: claim.kind, sourceQuote: claim.source_quote })),
    );
    console.log(
      Object.entries(slices)
        .map(([dimension, slice]) => `${dimension}: ${slice.length} potongan / ${slice.reduce((s, c) => s + c.text.length, 0)} karakter`)
        .join(" | "),
    );

    const started = Date.now();
    const result = await detectLlmFindings(provider, {
      claims: (claims ?? []).map((claim) => ({
        id: claim.id,
        kind: claim.kind,
        text: claim.text,
        sourceQuote: claim.source_quote,
      })),
      citations: (citations ?? []).map((citation) => citation.raw_text),
      chunks: [],
      dimensionChunks: Object.fromEntries(
        Object.entries(slices).map(([dimension, slice]) => [
          dimension,
          slice.map((chunk) => ({ section: chunk.sectionLabel, text: chunk.text })),
        ]),
      ),
      alreadyDetected: [],
    });
    const elapsed = Date.now() - started;
    console.log(
      `deteksi ${elapsed} ms (${provider.modelName}) per spesialis ${JSON.stringify(result.timings)}; ${result.findings.length} temuan, ${result.discarded} kutipan dibuang, gagal: ${result.failedDimensions.join(",") || "-"}`,
    );
    for (const finding of result.findings) {
      console.log(
        `  [${finding.weaknessType} s${finding.severity} c${finding.confidence}] "${finding.evidenceQuote.slice(0, 120)}" -- ${finding.rationale}`,
      );
    }
    expect(elapsed).toBeLessThan(45_000);
  }, 300_000);
});
