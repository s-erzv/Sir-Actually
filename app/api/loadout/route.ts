import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse, requireUser } from "@/lib/api/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { CHARACTERS, isCharacterUnlocked } from "@/lib/loadout";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const admin = getAdminSupabase();
    const { data: profile } = await admin
      .from("profiles")
      .select("points_earned, points_spent, unlocked_characters")
      .eq("id", user.id)
      .maybeSingle();

    const balance = Math.max(
      0,
      (profile?.points_earned ?? 0) - (profile?.points_spent ?? 0),
    );

    return NextResponse.json({
      pointsBalance: balance,
      characters: CHARACTERS.map((character) => ({
        slug: character.slug,
        unlockCost: character.unlockCost,
        unlocked: isCharacterUnlocked(character.slug, profile?.unlocked_characters),
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
