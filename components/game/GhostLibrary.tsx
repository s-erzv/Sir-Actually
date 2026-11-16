"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authJson } from "@/lib/api/client";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface CitationCard {
  id: string;
  rawText: string;
}

interface GhostLibraryProps {
  runId: string;
  onClose: () => void;
}

type Result =
  | { kind: "hit" }
  | { kind: "miss"; fakeRawText: string | null }
  | { kind: "done"; hit: boolean }
  | { kind: "empty" };

export default function GhostLibrary({ runId, onClose }: GhostLibraryProps) {
  const [citations, setCitations] = useState<CitationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const startedAt = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authJson<{
        done: boolean;
        hit?: boolean;
        citations?: CitationCard[];
        noCitations?: boolean;
      }>("/api/ghost/challenge", {
        method: "POST",
        body: JSON.stringify({ runId }),
      });
      if (data.done) setResult(data.noCitations ? { kind: "empty" } : { kind: "done", hit: Boolean(data.hit) });
      setCitations(data.citations ?? []);
      startedAt.current = performance.now();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Perpustakaan tidak bisa dibuka.");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  const flag = useCallback(
    async (citationId: string) => {
      if (busy || result) return;
      setBusy(true);
      setError(null);
      try {
        const data = await authJson<{ hit: boolean; fakeRawText: string | null }>(
          "/api/ghost/check",
          {
            method: "POST",
            body: JSON.stringify({
              runId,
              citationId,
              durationMs: Math.round(performance.now() - startedAt.current),
            }),
          },
        );
        setResult(data.hit ? { kind: "hit" } : { kind: "miss", fakeRawText: data.fakeRawText });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menandai referensi.");
      } finally {
        setBusy(false);
      }
    },
    [busy, result, runId],
  );

  const dialogRef = useFocusTrap<HTMLDivElement>();

  return (
    <div className="game-fade fixed inset-0 z-50 grid place-items-center bg-[#05080b]/94 px-3 py-5 backdrop-blur-[3px]">
      <div
        ref={dialogRef}
        className="game-screen-in max-h-[92vh] w-full max-w-3xl overflow-y-auto border-2 border-[#9fe3d8]/60 bg-[#081014] shadow-[8px_8px_0_#05080b,0_0_70px_rgba(159,227,216,0.12)]"
        role="dialog"
        aria-modal="true"
        aria-label="Perpustakaan Terkutuk"
      >
        <div className="flex items-center justify-between border-b-2 border-void bg-[#0b1a1e] px-4 py-2">
          <span className="font-pixel text-[0.55rem] uppercase tracking-[0.1em] text-[#9fe3d8]">
            Perpustakaan Terkutuk · Nyxara
          </span>
          <span className="text-[0.56rem] font-bold uppercase tracking-[0.08em] text-ash">
            Temukan satu referensi palsu
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-sm leading-6 text-ash">
            Nyxara menyelipkan satu rujukan yang tidak pernah ada. Tandai buku yang
            menurutmu palsu. Referensi asli tidak menghukummu.
          </p>

          {loading ? (
            <p className="mt-5 animate-pulse text-sm text-[#9fe3d8]">Membuka rak...</p>
          ) : error ? (
            <div className="mt-4 border border-blood/40 bg-blood/10 p-3 text-sm text-blood">
              {error}
              <button
                type="button"
                onClick={() => void load()}
                className="pixel-button pixel-button-sm ml-3 border-ridge bg-void text-bone"
              >
                Coba lagi
              </button>
              <button
                type="button"
                onClick={onClose}
                className="pixel-button pixel-button-sm ml-2 border-ridge bg-void text-ash"
              >
                Lewati
              </button>
            </div>
          ) : result ? (
            <div className="mt-4 border-2 border-ridge/60 bg-void/50 p-4">
              {result.kind === "hit" ? (
                <p className="text-sm font-bold text-moss">
                  Kena. Referensi itu memang palsu.
                </p>
              ) : result.kind === "miss" ? (
                <div className="text-sm leading-6 text-ash">
                  <p className="font-bold text-blood">Itu referensi asli.</p>
                  {result.fakeRawText ? (
                    <p className="mt-2 border-l-2 border-[#9fe3d8]/60 pl-3 text-bone">
                      Yang palsu: {result.fakeRawText}
                    </p>
                  ) : null}
                </div>
              ) : result.kind === "done" ? (
                <p className="text-sm text-ash">
                  Kamu sudah menandai referensi di perpustakaan ini.
                  {result.hit ? " Nyxara masih mengingatnya." : " Nyxara sempat lolos."}
                </p>
              ) : (
                <p className="text-sm text-ash">
                  Tidak ada referensi untuk diuji di naskah ini.
                </p>
              )}
              <button
                type="button"
                onClick={onClose}
                className="pixel-button pixel-button-sm mt-4 border-gold bg-gold text-void hover:bg-bone"
              >
                Lanjut ke Nyxara
              </button>
            </div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {citations.map((citation) => (
                <button
                  key={citation.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void flag(citation.id)}
                  className="border-2 border-ridge/60 bg-void/45 p-3 text-left text-[0.78rem] leading-5 text-bone transition hover:border-[#9fe3d8]/70 hover:bg-[#0b1a1e] disabled:opacity-50"
                >
                  {citation.rawText}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
