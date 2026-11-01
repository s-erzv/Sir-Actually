import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const { map, manuscript } = await loadOwnedResearchMap(id, user.id);
    const admin = getAdminSupabase();

    const [{ data: claims }, { data: citations }, { data: chunks }, { data: recon }] =
      await Promise.all([
        admin
          .from("claims")
          .select("id, research_map_id, kind, text, source_quote, position")
          .eq("research_map_id", id)
          .order("position"),
        admin
          .from("citations")
          .select("id, research_map_id, raw_text, parsed, verification_status, created_at")
          .eq("research_map_id", id)
          .eq("is_injected", false)
          .order("created_at"),
        admin
          .from("manuscript_chunks")
          .select("id, chunk_index, section_label, char_start, char_end")
          .eq("manuscript_id", manuscript.id)
          .eq("version", map.version)
          .order("chunk_index"),
        admin.from("recon_jobs").select("*").eq("research_map_id", id).maybeSingle(),
      ]);

    return NextResponse.json({
      manuscript,
      map: {
        id: map.id,
        manuscript_id: map.manuscript_id,
        version: map.version,
        status: map.status,
        source_text: map.source_text,
        completeness: map.completeness,
        created_at: map.created_at,
        confirmed_at: map.confirmed_at,
      },
      claims: claims ?? [],
      citations: citations ?? [],
      chunks: chunks ?? [],
      recon: recon ?? null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const PATCH_SCHEMA = z.object({
  claims: z
    .array(
      z.object({
        kind: z.enum([
          "problem",
          "gap",
          "objective",
          "rq",
          "method",
          "finding",
          "limitation",
          "conclusion",
        ]),
        text: z.string().trim().min(3).max(2000),
        sourceQuote: z.string().trim().min(3).max(4000),
        position: z.number().int().min(0),
      }),
    )
    .max(40),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const { map } = await loadOwnedResearchMap(id, user.id);
    if (map.status === "confirmed") {
      throw new ApiError("Research Map sudah dikonfirmasi dan beku.", 409);
    }

    const body = PATCH_SCHEMA.parse(await request.json());
    const normalizedSource = map.source_text.replace(/\s+/g, " ").toLowerCase();

    for (const claim of body.claims) {
      const quote = claim.sourceQuote.replace(/\s+/g, " ").toLowerCase();
      if (!normalizedSource.includes(quote)) {
        throw new ApiError(
          `Kutipan klaim tidak ditemukan persis di naskah: "${claim.sourceQuote.slice(0, 80)}"`,
          400,
        );
      }
    }

    const admin = getAdminSupabase();
    const { error: deleteError } = await admin
      .from("claims")
      .delete()
      .eq("research_map_id", id);
    if (deleteError) throw new ApiError(deleteError.message, 500);

    if (body.claims.length > 0) {
      const { error } = await admin.from("claims").insert(
        body.claims.map((claim, index) => ({
          research_map_id: id,
          kind: claim.kind,
          text: claim.text,
          source_quote: claim.sourceQuote,
          position: index,
        })),
      );
      if (error) throw new ApiError(error.message, 500);
    }

    return NextResponse.json({ ok: true, claimCount: body.claims.length });
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
