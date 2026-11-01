import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getLLMProviderForBoss } from "@/lib/llm";
import { pickAttackType, type AttackType } from "@/lib/planner/attackType";
import { BOSS_ROSTER, MINION_ROSTER, getMonsterDisplayName } from "@/lib/monsters";
import { PROMPT_VERSION } from "@/lib/prompts/questioner_v1";
import { retrieveChunks } from "@/lib/rag/retrieve";
import type { RagRpcClient } from "@/lib/rag/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const BODY = z.object({
  researchMapId: z.string().uuid(),
  findingId: z.string().uuid().optional(),
  bossSlug: z.string().min(1).max(80),
  weaknessType: z.string().min(1).max(80),
  evidenceQuote: z.string().max(4000).optional(),
  previousQuestions: z.array(z.string().max(2000)).max(12).default([]),
  previousAttackTypes: z.array(z.string().max(40)).max(12).default([]),
  isBoss: z.boolean().optional(),
});

function personaFor(bossSlug: string): string {
  const boss = BOSS_ROSTER[bossSlug];
  if (boss) return `${boss.name} — ${boss.title}. ${boss.lore}`;
  if (bossSlug.startsWith("minion-")) {
    const minion = MINION_ROSTER.find((item) => `minion-${item.slug}` === bossSlug);
    if (minion) return `${minion.name} (${minion.character}). ${minion.lore}`;
  }
  return getMonsterDisplayName(bossSlug);
}

function questionIsValid(question: string): boolean {
  const text = question.trim();
  if (!text || text.includes("\n") || text.includes("[Dummy]")) return false;
  if ((text.match(/\?/g) ?? []).length !== 1) return false;
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= 28;
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

    const weaknessType = finding?.weakness_type ?? body.weaknessType;
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

    const summary =
      (claims ?? [])
        .slice(0, 40)
        .map((claim) => `- ${claim.kind}: ${claim.text}`)
        .join("\n") || map.source_text.slice(0, 4000);

    const { data: weakness, error: weaknessError } = await admin
      .from("weakness_types")
      .select("attack_types")
      .eq("slug", weaknessType)
      .maybeSingle();
    if (weaknessError) throw new ApiError(weaknessError.message, 500);

    const allowed = ((weakness?.attack_types ?? []) as AttackType[]).filter(Boolean);
    if (allowed.length === 0) {
      throw new ApiError("Tipe kelemahan belum punya bentuk serangan.", 422);
    }
    const lastAttack = body.previousAttackTypes.at(-1) as AttackType | undefined;
    const attackType = pickAttackType(
      allowed,
      body.previousAttackTypes as AttackType[],
      lastAttack,
      0,
    );

    const provider = getLLMProviderForBoss(body.bossSlug);
    if (provider.providerName === "dummy") {
      throw new ApiError("LLM belum dikonfigurasi untuk membuat pertanyaan.", 503);
    }

    const retrieval = await retrieveChunks(admin as unknown as RagRpcClient, {
      manuscriptId: map.manuscript_id,
      version: map.version,
      query: [evidenceQuote, weaknessType].filter(Boolean).join(" "),
      limit: 4,
    });
    const contextChunks = retrieval.chunks.map((chunk) => ({
      section: chunk.sectionLabel,
      text: chunk.text,
    }));

    const input = {
      evidenceQuote,
      weaknessType,
      attackType,
      bossPersona: personaFor(body.bossSlug),
      researchMapSummary: summary,
      previousQuestions: body.previousQuestions,
      contextChunks,
    };

    let question = await provider.generateQuestion(input);
    if (!questionIsValid(question)) {
      question = await provider.generateQuestion({
        ...input,
        previousQuestions: [
          ...input.previousQuestions,
          "Pertanyaan sebelumnya terlalu panjang atau tidak valid. Tulis ulang maksimal 28 kata, satu tanda tanya.",
        ],
      });
    }
    if (!questionIsValid(question)) {
      throw new ApiError("Questioner gagal membuat pertanyaan yang valid.", 502);
    }

    return NextResponse.json({
      question: question.trim(),
      attackType,
      promptVersion: PROMPT_VERSION,
      model: provider.modelName,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
