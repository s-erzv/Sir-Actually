import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getLLMProviderForBoss } from "@/lib/llm";
import { generateEncounterQuestions } from "@/lib/encounter/generate";
import { mergeQuestionBank } from "@/lib/encounter/questionBank";
import type { AttackType } from "@/lib/planner/attackType";
import type { Json } from "@/lib/supabase/database";

export const runtime = "nodejs";
export const maxDuration = 120;

const BODY = z.object({
  researchMapId: z.string().uuid(),
  encounterKey: z.string().min(1).max(120).optional(),
  findingId: z.string().uuid().optional(),
  bossSlug: z.string().min(1).max(80),
  weaknessType: z.string().min(1).max(80),
  evidenceQuote: z.string().max(4000).optional(),
  previousQuestions: z.array(z.string().max(2000)).max(12).default([]),
  previousAttackTypes: z.array(z.string().max(40)).max(12).default([]),
  isBoss: z.boolean().optional(),
  floorOrder: z.number().int().min(1).max(12).default(1),
  roomOrder: z.number().int().min(0).max(40).default(0),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const parsed = BODY.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Input tidak valid.", 400);
    }
    const body = parsed.data;
    const { map } = await loadOwnedResearchMap(body.researchMapId, user.id);

    const provider = getLLMProviderForBoss(body.bossSlug);
    if (provider.providerName === "dummy") {
      throw new ApiError("LLM belum dikonfigurasi untuk membuat pertanyaan.", 503);
    }

    const admin = getAdminSupabase();
    const [generated] = await generateEncounterQuestions({
      admin,
      map,
      provider,
      bossSlug: body.bossSlug,
      weaknessType: body.weaknessType,
      isBoss: body.isBoss ?? false,
      floorOrder: body.floorOrder,
      roomOrder: body.roomOrder,
      findingId: body.findingId,
      evidenceQuote: body.evidenceQuote,
      previousQuestions: body.previousQuestions,
      previousAttackTypes: body.previousAttackTypes as AttackType[],
      count: 1,
    });
    if (!generated) throw new ApiError("Questioner tidak menghasilkan pertanyaan.", 502);

    // Cache fallback questions too, so the answer route can verify them.
    if (body.encounterKey) {
      const merged = mergeQuestionBank(map.question_bank, body.encounterKey, [generated]);
      const { error: cacheError } = await admin
        .from("research_maps")
        .update({ question_bank: merged as unknown as Json })
        .eq("id", map.id);
      if (cacheError) throw new ApiError(cacheError.message, 500);
    }

    return NextResponse.json(generated);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
