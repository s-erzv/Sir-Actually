import { ApiError } from "@/lib/api/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database";

type ResearchMapRow = Database["public"]["Tables"]["research_maps"]["Row"];
type ManuscriptRow = Database["public"]["Tables"]["manuscripts"]["Row"];

export interface OwnedResearchMap {
  map: ResearchMapRow;
  manuscript: ManuscriptRow;
}

export async function loadOwnedResearchMap(
  researchMapId: string,
  userId: string,
): Promise<OwnedResearchMap> {
  const admin = getAdminSupabase();
  const { data: map, error } = await admin
    .from("research_maps")
    .select("*")
    .eq("id", researchMapId)
    .maybeSingle();

  if (error) throw new ApiError(error.message, 500);
  if (!map) throw new ApiError("Research Map tidak ditemukan.", 404);

  const { data: manuscript, error: manuscriptError } = await admin
    .from("manuscripts")
    .select("*")
    .eq("id", map.manuscript_id)
    .maybeSingle();

  if (manuscriptError) throw new ApiError(manuscriptError.message, 500);
  if (!manuscript || manuscript.owner_id !== userId) {
    throw new ApiError("Akses ditolak.", 403);
  }
  if (manuscript.deleted_at) throw new ApiError("Naskah sudah dihapus.", 410);

  return { map, manuscript };
}
