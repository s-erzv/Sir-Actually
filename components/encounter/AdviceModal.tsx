"use client";

import { useCallback, useEffect, useState } from "react";
import type { WeaknessType } from "@/lib/domain/types";
import { authJson } from "@/lib/api/client";
import { PixelSprite } from "@/components/brand/PixelSprite";

interface Debrief {
  what_failed: string;
  criterion_id: string;
  answer_quote: string;
  evidence_quote: string;
  question_back: string;
  tactical_hint: string;
}

interface AdviceModalProps {
  researchMapId: string;
  findingId?: string;
  bossSlug: string;
  weaknessType: WeaknessType;
  evidenceQuote: string;
  playerAnswer: string;
  missing: string;
  scores: Array<{ criterionId: string; level: number }>;
  onRetry: () => void;
  onRevise: () => void;
}

export default function AdviceModal({
  researchMapId,
  findingId,
  bossSlug,
  weaknessType,
  evidenceQuote,
  playerAnswer,
  missing,
  scores,
  onRetry,
  onRevise,
}: AdviceModalProps) {
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        researchMapId,
        bossSlug,
        weaknessType,
        evidenceQuote,
        playerAnswer,
        missing,
        scores,
        ...(findingId ? { findingId } : {}),
      };
      const data = await authJson<Debrief>("/api/encounter/debrief", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setDebrief(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat debrief.");
    } finally {
      setLoading(false);
    }
  }, [researchMapId, findingId, bossSlug, weaknessType, evidenceQuote, playerAnswer, missing, scores]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-void/90 px-4 backdrop-blur-sm">
      <div className="parchment max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b-2 border-[#a98e5d] pb-3">
          <div>
            <p className="font-pixel text-[0.58rem] text-[#6b4b1e]">Catatan Penjaga</p>
            <h2 className="mt-2 text-xl font-bold text-[#2b2318]">Sebelum mencoba lagi.</h2>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center border-2 border-[#2c2114] bg-[#d9c18b]">
            <PixelSprite kind="scroll" size={32} />
          </div>
        </div>

        {loading && (
          <p className="mt-5 text-sm leading-6 text-[#4a3a25]">Penguji menyusun catatan...</p>
        )}

        {error && (
          <div className="mt-5 border-2 border-[#8a3a2a]/40 bg-[#e3d0a6] p-3 text-sm text-[#6b2b1e]">
            <p>{error}</p>
            <button
              onClick={() => void load()}
              className="pixel-button pixel-button-sm mt-3 border-[#2c2114] bg-[#2b2318] text-[#f4e7c7] hover:bg-[#4a3a25]"
            >
              Coba lagi
            </button>
          </div>
        )}

        {debrief && !loading && (
          <>
            {evidenceQuote ? (
              <blockquote className="mt-4 border-l-2 border-[#a98e5d] bg-[#e3d0a6]/65 py-2 pl-3 text-sm italic leading-6 text-[#4a3a25]">
                {evidenceQuote}
              </blockquote>
            ) : null}

            <section className="mt-5">
              <p className="font-pixel text-[0.56rem] leading-4 text-[#6b4b1e]">Yang tadi kurang</p>
              <p className="mt-2 text-[0.95rem] leading-7 text-[#2b2318]">{debrief.what_failed}</p>
              <p className="mt-2 text-xs leading-5 text-[#6d5c3f]">
                Kriteria: {debrief.criterion_id}
              </p>
            </section>

            <section className="mt-5">
              <p className="font-pixel text-[0.56rem] leading-4 text-[#6b4b1e]">Jawabanmu</p>
              <p className="mt-2 text-sm italic leading-6 text-[#4a3a25]">“{debrief.answer_quote}”</p>
            </section>

            <section className="mt-5">
              <p className="font-pixel text-[0.56rem] leading-4 text-[#6b4b1e]">Bukti yang belum dipakai</p>
              <p className="mt-2 text-sm leading-6 text-[#4a3a25]">“{debrief.evidence_quote}”</p>
            </section>

            <section className="mt-5">
              <p className="font-pixel text-[0.56rem] leading-4 text-[#6b4b1e]">Pertanyaan balik</p>
              <p className="mt-2 text-[0.95rem] leading-7 text-[#2b2318]">{debrief.question_back}</p>
            </section>

            <p className="mt-4 border-l-2 border-[#a98e5d] pl-3 text-sm leading-6 text-[#4a3a25]">
              {debrief.tactical_hint}
            </p>
          </>
        )}

        <p className="mt-5 border-t-2 border-[#a98e5d] pt-3 text-xs leading-5 text-[#6d5c3f]">
          Catatan Penjaga bukan pengganti dosen pembimbing. Pertanyaan di atas adalah
          titik awal refleksi — keputusan ada di tanganmu.
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            onClick={onRevise}
            disabled
            title="Tersedia di M3"
            className="pixel-button pixel-button-sm cursor-not-allowed border-[#2c2114] bg-[#d9c18b] text-[#6d5c3f] opacity-55"
          >
            Perbaiki naskah
          </button>
          <button
            onClick={onRetry}
            className="pixel-button pixel-button-sm border-[#2c2114] bg-[#2b2318] text-[#f4e7c7] hover:bg-[#4a3a25]"
          >
            Ulangi lantai
          </button>
        </div>
      </div>
    </div>
  );
}
