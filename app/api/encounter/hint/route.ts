import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api/auth";
import { loadOwnedResearchMap } from "@/lib/api/researchMap";
import { getLLMProviderForBoss } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const BODY = z.object({
  researchMapId: z.string().uuid(),
  question: z.string().trim().min(5).max(2000),
  weaknessType: z.string().min(1).max(80).default("gap_unsupported"),
  bossSlug: z.string().min(1).max(80).optional(),
  evidenceQuote: z.string().max(4000).optional(),
});

const SYSTEM = `Kamu adalah penerjemah pertanyaan ujian akademik. Tugasmu HANYA menjelaskan maksud pertanyaan dengan bahasa Indonesia yang lebih sederhana.

ATURAN:
- Maksimal 2 kalimat pendek.
- Jangan menjawab pertanyaan itu.
- Jangan menyebut jawaban yang benar, angka, sitasi, atau temuan baru.
- Jangan mengarang bukti dari naskah.
- Jelaskan: apa yang diminta dari pemain, dan bagian mana yang perlu diperiksa.
- Boleh memakai analogi singkat, tetapi tetap fokus pada pertanyaan.
- Balas teks biasa, tanpa markdown, tanpa daftar, tanpa tanda kutip pembuka.`;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser(request);
    const parsed = BODY.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Input tidak valid.", 400);
    }
    const body = parsed.data;
    await loadOwnedResearchMap(body.researchMapId, user.id);

    const provider = getLLMProviderForBoss(body.bossSlug);
    if (provider.providerName === "dummy") {
      throw new ApiError("LLM belum dikonfigurasi untuk membuat petunjuk.", 503);
    }

    const hint = await provider.completeText(
      SYSTEM,
      `Pertanyaan penguji:
"${body.question}"

Jenis kelemahan: ${body.weaknessType}
Kutipan yang diserang: "${body.evidenceQuote ?? ""}"

Jelaskan maksud pertanyaan di atas dalam 1–2 kalimat sederhana. Jangan menjawabnya.`,
      0.2,
    );

    const cleaned = hint.replace(/\s+/g, " ").trim().slice(0, 420);
    if (!cleaned) throw new ApiError("Petunjuk kosong. Coba lagi.", 502);

    return NextResponse.json({ hint: cleaned, model: provider.modelName });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
