"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WeaknessType } from "@/lib/domain/types";
import { authJson } from "@/lib/api/client";
import { RUBRICS } from "@/lib/rubrics";
import { PixelSprite } from "@/components/brand/PixelSprite";

interface Debrief {
  what_failed: string;
  criterion_id: string;
  answer_quote: string;
  evidence_quote: string;
  question_back: string;
  tactical_hint: string;
}

export interface AdviceHistoryEntry {
  answer: string;
  scores: Array<{ criterionId: string; level: number }>;
  missing: string;
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
  history: AdviceHistoryEntry[];
  onRetry: () => void;
  onRevise: () => void;
}

const LEVEL_COLOUR = ["#a1abb3", "#b8792c", "#4f7d3a"];
const LEVEL_LABEL = ["Tidak ada", "Disebut", "Didukung"];

export default function AdviceModal({
  researchMapId,
  findingId,
  bossSlug,
  weaknessType,
  evidenceQuote,
  playerAnswer,
  missing,
  scores,
  history,
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
        history,
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
  }, [
    researchMapId,
    findingId,
    bossSlug,
    weaknessType,
    evidenceQuote,
    playerAnswer,
    missing,
    scores,
    history,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const rubric = RUBRICS[weaknessType] ?? [];
  const pattern = useMemo(() => {
    return rubric.map((criterion) => {
      const levels = history.flatMap((entry) =>
        entry.scores
          .filter((score) => score.criterionId === criterion.id)
          .map((score) => score.level),
      );
      if (levels.length === 0) {
        const last = scores.find((score) => score.criterionId === criterion.id);
        if (last) levels.push(last.level);
      }
      return {
        ...criterion,
        worst: levels.length > 0 ? Math.min(...levels) : 0,
        best: levels.length > 0 ? Math.max(...levels) : 0,
      };
    });
  }, [rubric, history, scores]);

  const scoreMax = rubric.length * 2;
  const average = useMemo(() => {
    if (history.length === 0) return 0;
    return (
      history.reduce(
        (sum, entry) => sum + entry.scores.reduce((total, score) => total + score.level, 0),
        0,
      ) / history.length
    );
  }, [history]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#05080b]/92 px-3 py-4 backdrop-blur-sm">
      <div className="debrief-paper max-h-[94vh] w-full max-w-2xl overflow-y-auto border-2 border-[#2c2114] shadow-[8px_8px_0_#05080b]">
        <header className="flex items-start justify-between gap-4 border-b-2 border-[#2c2114]/70 bg-[#2b2318] px-5 py-4 text-[#f4e7c7]">
          <div>
            <p className="font-pixel text-[0.56rem] text-[#e9b85d]">Catatan Penjaga</p>
            <h2 className="mt-1 text-xl font-bold">Sebelum mencoba lagi.</h2>
            <p className="mt-1 text-[0.68rem] uppercase tracking-[0.08em] text-[#cbb98f]">
              {history.length} jawaban tercatat dalam pertarungan ini
            </p>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center border-2 border-[#e9b85d]/60 bg-[#3a3020]">
            <PixelSprite kind="scroll" size={34} />
          </div>
        </header>

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="border border-[#8a744c]/50 bg-[#efe1bf]/70 p-4">
              <p className="font-pixel text-[0.54rem] text-[#6b4b1e]">MENYUSUN CATATAN</p>
              <p className="mt-2 text-sm leading-6 text-[#4a3a25]">
                Penguji membaca seluruh jawabanmu, bukan cuma yang terakhir...
              </p>
              <div className="bar-track mt-3 overflow-hidden border-[#8a744c] bg-[#d8c49a]">
                <div className="entry-load-fill" />
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="border-2 border-[#8a3a2a]/40 bg-[#e3d0a6] p-3 text-sm text-[#6b2b1e]">
              <p>{error}</p>
              <button
                onClick={() => void load()}
                className="pixel-button pixel-button-sm mt-3 border-[#2c2114] bg-[#2b2318] text-[#f4e7c7] hover:bg-[#4a3a25]"
              >
                Coba lagi
              </button>
            </div>
          ) : null}

          {!loading && debrief ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
                <section className="border-2 border-[#8a744c]/45 bg-[#efe1bf]/75 p-3">
                  <p className="font-pixel text-[0.54rem] uppercase tracking-[0.08em] text-[#6b4b1e]">
                    Pola pertarungan
                  </p>
                  <p className="mt-1 text-[0.74rem] leading-5 text-[#4a3a25]">
                    Rata-rata {average.toFixed(1)} / {scoreMax} poin per jawaban.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {pattern.map((criterion) => (
                      <li key={criterion.id}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[0.74rem] leading-5 text-[#2b2318]">
                            {criterion.label}
                          </span>
                          <span
                            className="shrink-0 font-pixel text-[0.52rem]"
                            style={{ color: LEVEL_COLOUR[criterion.worst] }}
                          >
                            {LEVEL_LABEL[criterion.worst]}
                          </span>
                        </div>
                        <div className="mt-1 flex gap-1">
                          {[0, 1].map((step) => (
                            <span
                              key={step}
                              className="h-1.5 flex-1"
                              style={{
                                background:
                                  step < criterion.worst
                                    ? LEVEL_COLOUR[criterion.worst]
                                    : "#c8b48a",
                              }}
                            />
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="border-2 border-[#8a744c]/45 bg-[#efe1bf]/75 p-3">
                  <p className="font-pixel text-[0.54rem] uppercase tracking-[0.08em] text-[#6b4b1e]">
                    Yang tadi kurang
                  </p>
                  <p className="mt-2 text-[0.9rem] leading-6 text-[#2b2318]">
                    {debrief.what_failed}
                  </p>
                  <p className="mt-2 inline-block border border-[#8a744c]/50 bg-[#d8c49a]/60 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.06em] text-[#6d5c3f]">
                    Kriteria: {debrief.criterion_id}
                  </p>
                </section>
              </div>

              <blockquote className="mt-3 border-l-4 border-[#8a744c] bg-[#e3d0a6]/70 py-2 pl-3 text-sm italic leading-6 text-[#4a3a25]">
                “{debrief.answer_quote}”
              </blockquote>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <section className="border border-[#8a744c]/40 bg-[#efe1bf]/60 p-3">
                  <p className="font-pixel text-[0.54rem] uppercase tracking-[0.08em] text-[#6b4b1e]">
                    Bukti yang belum dipakai
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#4a3a25]">
                    “{debrief.evidence_quote}”
                  </p>
                </section>

                <section className="border border-[#8a744c]/40 bg-[#efe1bf]/60 p-3">
                  <p className="font-pixel text-[0.54rem] uppercase tracking-[0.08em] text-[#6b4b1e]">
                    Pertanyaan balik
                  </p>
                  <p className="mt-2 text-[0.9rem] leading-6 text-[#2b2318]">
                    {debrief.question_back}
                  </p>
                </section>
              </div>

              <p className="mt-3 border-l-4 border-[#b8792c] bg-[#e3d0a6]/70 py-2 pl-3 text-sm leading-6 text-[#4a3a25]">
                <span className="font-bold text-[#6b4b1e]">Saran taktis: </span>
                {debrief.tactical_hint}
              </p>
            </>
          ) : null}

          <p className="mt-4 border-t-2 border-[#8a744c]/50 pt-3 text-xs leading-5 text-[#6d5c3f]">
            Catatan Penjaga bukan pengganti dosen pembimbing. Pertanyaan di atas adalah
            titik awal refleksi — keputusan ada di tanganmu.
          </p>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
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
    </div>
  );
}
