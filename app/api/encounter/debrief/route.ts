import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getLLMProviderForBoss } from "@/lib/llm";
import { RUBRICS } from "@/lib/rubrics";
import { BOSS_ROSTER, MINION_ROSTER, getMonsterDisplayName } from "@/lib/monsters";
import { DEBRIEF_SYSTEM, PROMPT_VERSION, buildDebriefPrompt } from "@/lib/prompts/debrief_v1";
import { retrieveChunks } from "@/lib/rag/retrieve";
import type { RagRpcClient } from "@/lib/rag/types";
import type { WeaknessType } from "@/lib/domain/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const BODY = z.object({
  researchMapId: z.string().uuid(),
  findingId: z.string().uuid().optional(),
  bossSlug: z.string().min(1).max(80),
  weaknessType: z.string().min(1).max(80),
  evidenceQuote: z.string().max(4000).optional(),
  playerAnswer: z.string().max(4000),
  missing: z.string().max(2000).optional(),
  scores: z
    .array(z.object({ criterionId: z.string(), level: z.number().int().min(0).max(2) }))
    .max(6)
    .optional(),
});

const OUTPUT = z.object({
  what_failed: z.string().trim().min(3).max(500),
  criterion_id: z.string().trim().min(1).max(80),
  answer_quote: z.string().trim().min(1).max(500),
  evidence_quote: z.string().trim().min(1).max(1000),
  question_back: z.string().trim().min(3).max(400),
  tactical_hint: z.string().trim().min(3).max(500),
});

function normalize(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function personaFor(bossSlug: string): string {
  const boss = BOSS_ROSTER[bossSlug];
  if (boss) return `${boss.name} — ${boss.title}`;
  if (bossSlug.startsWith("minion-")) {
    const minion = MINION_ROSTER.find((item) => `minion-${item.slug}` === bossSlug);
    if (minion) return `${minion.name} (${minion.character})`;
  }
  return getMonsterDisplayName(bossSlug);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const parsed = BODY.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Input tidak valid.", 400);
    }
    const body = parsed.data;
    const { map } = await loadOwnedResearchMap(body.researchMapId, user.id);
    const admin = getAdminSupabase();

    let finding: { weakness_type: string; evidence_quote: string } | null = null;
    if (body.findingId) {
      const { data, error } = await admin
        .from("findings")
        .select("research_map_id, weakness_type, evidence_quote")
        .eq("id", body.findingId)
        .maybeSingle();
      if (error) throw new ApiError(error.message, 500);
      if (!data || data.research_map_id !== map.id) {
        throw new ApiError("Temuan tidak ditemukan.", 404);
      }
      finding = data;
    }

    const { data: claims, error: claimsError } = await admin
      .from("claims")
      .select("kind, text, source_quote, position")
      .eq("research_map_id", map.id)
      .order("position");
    if (claimsError) throw new ApiError(claimsError.message, 500);

    const weaknessType = (finding?.weakness_type ?? body.weaknessType) as WeaknessType;
    const rubric = RUBRICS[weaknessType];
    if (!rubric) throw new ApiError("Rubrik tidak ditemukan.", 422);
    const ids = new Set(rubric.map((criterion) => criterion.id));
    const failedCriteria = rubric.map((criterion) => {
      const score = body.scores?.find((item) => item.criterionId === criterion.id);
      return { id: criterion.id, label: criterion.label, level: score?.level ?? 0 };
    });

    const focusClaim =
      claims?.find((claim) => claim.kind === "conclusion") ??
      claims?.find((claim) => claim.kind === "rq") ??
      claims?.[0];
    const evidenceQuote =
      finding?.evidence_quote ||
      body.evidenceQuote ||
      focusClaim?.source_quote ||
      focusClaim?.text ||
      map.source_text.slice(0, 1200);
    const claimsSummary =
      (claims ?? [])
        .slice(0, 30)
        .map((claim) => `- ${claim.kind}: ${claim.text}`)
        .join("\n") || map.source_text.slice(0, 3000);

    const provider = getLLMProviderForBoss(body.bossSlug);
    if (provider.providerName === "dummy") {
      throw new ApiError("LLM belum dikonfigurasi untuk debrief.", 503);
    }

    const retrieval = await retrieveChunks(admin as unknown as RagRpcClient, {
      manuscriptId: map.manuscript_id,
      version: map.version,
      query: [evidenceQuote, body.missing ?? "", weaknessType].filter(Boolean).join(" "),
      limit: 3,
    });

    const promptInput = {
      weaknessType,
      bossName: personaFor(body.bossSlug),
      playerAnswer: body.playerAnswer,
      missing: body.missing ?? "",
      failedCriteria,
      evidenceQuote,
      claimsSummary,
      contextChunks: retrieval.chunks.map((chunk) => ({
        section: chunk.sectionLabel,
        text: chunk.text,
      })),
    };

    let raw = await provider.completeJson(DEBRIEF_SYSTEM, buildDebriefPrompt(promptInput), 0.2);
    let output = OUTPUT.safeParse(raw);
    if (!output.success) {
      raw = await provider.completeJson(
        `${DEBRIEF_SYSTEM}\n\nOutput sebelumnya tidak valid. Kembalikan JSON sesuai bentuk.`,
        buildDebriefPrompt(promptInput),
        0,
      );
      output = OUTPUT.safeParse(raw);
    }
    if (!output.success) {
      throw new ApiError("Debrief gagal menghasilkan JSON valid.", 502);
    }

    const answer = normalize(body.playerAnswer);
    const source = normalize(map.source_text);
    if (!answer.includes(normalize(output.data.answer_quote))) {
      throw new ApiError("Kutipan jawaban pada debrief tidak valid.", 502);
    }
    if (!source.includes(normalize(output.data.evidence_quote))) {
      throw new ApiError("Kutipan naskah pada debrief tidak valid.", 502);
    }
    if (!ids.has(output.data.criterion_id)) {
      throw new ApiError("Kriteria pada debrief tidak ada di rubrik.", 502);
    }

    return NextResponse.json({
      ...output.data,
      promptVersion: PROMPT_VERSION,
      model: provider.modelName,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
