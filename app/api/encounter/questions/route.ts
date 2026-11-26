/**
 * POST /api/encounter/questions — prefetch a bank of questions for a floor.
 *
 * Called while the floor map is prepared, so entering an encounter never waits
 * on the Questioner. If a bank runs out (or the player retries after a KO),
 * the client falls back to the single `/api/encounter/question` route.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getLLMProviderForBoss } from "@/lib/llm";
import { generateEncounterQuestions } from "@/lib/encounter/generate";
import { type GeneratedQuestion } from "@/lib/encounter/schema";
import { parseQuestionBank } from "@/lib/encounter/questionBank";
import { MAX_QUESTIONS_BOSS, MAX_QUESTIONS_MINION } from "@/lib/balance";
import { FLOOR_LAYOUT_VERSION } from "@/game/map/buildFloorPlan";
import type { Json } from "@/lib/supabase/database";

export const runtime = "nodejs";
export const maxDuration = 120;

const ENCOUNTER = z.object({
  encounterKey: z.string().min(1).max(120),
  findingId: z.string().uuid().optional(),
  bossSlug: z.string().min(1).max(80),
  weaknessType: z.string().min(1).max(80),
  evidenceQuote: z.string().max(4000).optional(),
  isBoss: z.boolean(),
  floorOrder: z.number().int().min(1).max(12),
  roomOrder: z.number().int().min(0).max(80),
  count: z.number().int().min(1).max(MAX_QUESTIONS_BOSS).optional(),
});

const BODY = z.object({
  researchMapId: z.string().uuid(),
  encounters: z.array(ENCOUNTER).min(1).max(80),
});

function prefetchCap(name: string, fallback: number): number {
  const value = Math.trunc(Number(process.env[name] ?? fallback));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(4, value));
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

function readQuestionBank(value: unknown): Record<string, GeneratedQuestion[]> {
  return parseQuestionBank(value);
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
    const bank = readQuestionBank(map.question_bank);
    const minionCap = prefetchCap("QUESTION_PREFETCH_MINION", MAX_QUESTIONS_MINION);
    const bossCap = prefetchCap("QUESTION_PREFETCH_BOSS", MAX_QUESTIONS_BOSS);

    const entries = await mapLimit(body.encounters, 4, async (encounter) => {
      const cached = bank[encounter.encounterKey];
      if (cached?.length) return { key: encounter.encounterKey, questions: cached };

      const provider = getLLMProviderForBoss(encounter.bossSlug);
      if (provider.providerName === "dummy") {
        return { key: encounter.encounterKey, questions: [] as GeneratedQuestion[] };
      }
      try {
        const questions = await generateEncounterQuestions({
          admin,
          map,
          provider,
          bossSlug: encounter.bossSlug,
          weaknessType: encounter.weaknessType,
          isBoss: encounter.isBoss,
          floorOrder: encounter.floorOrder,
          roomOrder: encounter.roomOrder,
          findingId: encounter.findingId,
          evidenceQuote: encounter.evidenceQuote,
          count: Math.min(
            encounter.count ??
              (encounter.isBoss ? MAX_QUESTIONS_BOSS : MAX_QUESTIONS_MINION),
            encounter.isBoss ? bossCap : minionCap,
          ),
        });
        return { key: encounter.encounterKey, questions };
      } catch {
        // One bad encounter must not sink the whole floor bank.
        return { key: encounter.encounterKey, questions: [] as GeneratedQuestion[] };
      }
    });

    const questions: Record<string, GeneratedQuestion[]> = {};
    let generatedAny = false;
    for (const entry of entries) {
      questions[entry.key] = entry.questions;
      if (entry.questions.length > 0 && !bank[entry.key]) {
        bank[entry.key] = entry.questions;
        generatedAny = true;
      }
    }

    if (generatedAny && map.status !== "confirmed") {
      const { error: cacheError } = await admin
        .from("research_maps")
        .update({
          question_bank: {
            layoutVersion: FLOOR_LAYOUT_VERSION,
            banks: bank,
          } as unknown as Json,
        })
        .eq("id", map.id);
      // Confirmed maps are frozen by a DB trigger. The client still receives
      // these questions; persistence is a cache, not a requirement.
      if (cacheError) console.warn("[questions cache]", cacheError.message);
    }

    return NextResponse.json({ questions });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
