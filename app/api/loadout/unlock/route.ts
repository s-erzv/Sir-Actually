import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getCharacter } from "@/lib/loadout";

const BODY = z.object({ characterSlug: z.string().min(1).max(40) });

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const parsed = BODY.safeParse(await request.json());
    if (!parsed.success) throw new ApiError("Karakter tidak valid.", 400);

    const character = getCharacter(parsed.data.characterSlug);
    if (!character) throw new ApiError("Karakter tidak ditemukan.", 404);

    const admin = getAdminSupabase();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("points_earned, points_spent, unlocked_characters")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw new ApiError(error.message, 500);

    const earned = profile?.points_earned ?? 0;
    const spent = profile?.points_spent ?? 0;
    const balance = Math.max(0, earned - spent);
    const unlocked = profile?.unlocked_characters ?? [];

    if (character.unlockCost === 0 || unlocked.includes(character.slug)) {
      return NextResponse.json({
        ok: true,
        alreadyUnlocked: true,
        pointsBalance: balance,
        unlockedCharacters: unlocked,
      });
    }

    if (balance < character.unlockCost) {
      throw new ApiError(
        `Poin belum cukup. Butuh ${character.unlockCost}, punya ${balance}.`,
        409,
      );
    }

    const nextUnlocked = [...new Set([...unlocked, character.slug])];
    const nextSpent = spent + character.unlockCost;
    const { error: updateError } = await admin.from("profiles").upsert(
      {
        id: user.id,
        display_name: user.email?.split("@")[0] ?? null,
        points_spent: nextSpent,
        unlocked_characters: nextUnlocked,
      },
      { onConflict: "id" },
    );
    if (updateError) throw new ApiError(updateError.message, 500);

    return NextResponse.json({
      ok: true,
      alreadyUnlocked: false,
      pointsBalance: Math.max(0, earned - nextSpent),
      unlockedCharacters: nextUnlocked,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
