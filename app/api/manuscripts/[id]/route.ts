import { NextResponse, type NextRequest } from "next/server";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const admin = getAdminSupabase();

    const { data: manuscript, error } = await admin
      .from("manuscripts")
      .select("id, owner_id, deleted_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new ApiError(error.message, 500);
    if (!manuscript) throw new ApiError("Naskah tidak ditemukan.", 404);
    if (manuscript.owner_id !== user.id) throw new ApiError("Akses ditolak.", 403);

    if (manuscript.deleted_at) {
      return NextResponse.json({ ok: true, alreadyDeleted: true });
    }

    const hard = request.nextUrl.searchParams.get("hard") === "true";
    if (hard) {
      const { error: deleteError } = await admin.from("manuscripts").delete().eq("id", id);
      if (deleteError) throw new ApiError(deleteError.message, 500);
      return NextResponse.json({ ok: true, hard: true });
    }

    const { error: updateError } = await admin
      .from("manuscripts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) throw new ApiError(updateError.message, 500);

    return NextResponse.json({ ok: true, hard: false });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
