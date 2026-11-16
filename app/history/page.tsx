"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { authJson } from "@/lib/api/client";

interface RunHistoryItem {
  id: string;
  status: "finished" | "closed_revised";
  pointsTotal: number;
  rank: string | null;
  dungeonTitle: string | null;
  manuscriptTitle: string;
  startedAt: string;
  finishedAt: string | null;
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<RunHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void authJson<{ runs: RunHistoryItem[] }>("/api/run/history")
      .then((data) => setRuns(data.runs))
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal membuka riwayat."));
  }, []);

  return (
    <main className="dungeon-bg scanlines min-h-screen">
      <header className="border-b-2 border-void bg-void/90">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="hover:opacity-90">
            <Logo tagline />
          </Link>
          <Link
            href="/dashboard"
            className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ash hover:text-gold"
          >
            Kembali ke arsip
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="eyebrow">Riwayat</p>
        <h1 className="mt-2 text-3xl font-bold text-bone">Ekspedisi selesai</h1>

        {error ? (
          <p className="mt-6 border-2 border-blood/40 bg-blood/10 p-4 text-sm text-blood">{error}</p>
        ) : !runs ? (
          <p className="mt-6 text-sm text-ash">Membuka arsip...</p>
        ) : runs.length === 0 ? (
          <p className="mt-6 border-2 border-ridge/60 bg-void/45 p-4 text-sm text-ash">
            Belum ada run yang selesai.
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {runs.map((run) => (
              <li key={run.id}>
                <Link
                  href={`/report/${run.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 border-2 border-ridge/60 bg-void/45 px-4 py-3 transition hover:border-gold/60 hover:bg-[#111920]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-bone">
                      {run.manuscriptTitle}
                    </p>
                    <p className="mt-0.5 truncate text-[0.62rem] uppercase tracking-[0.07em] text-ash">
                      {run.dungeonTitle ?? "Dungeon naskah"} ·{" "}
                      {run.status === "closed_revised" ? "ditutup untuk revisi" : "selesai"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[0.62rem] font-bold uppercase tracking-[0.07em] text-ash">
                      {run.pointsTotal} poin
                    </span>
                    <span className="grid h-9 w-9 place-items-center border-2 border-gold/50 bg-gold/10 font-pixel text-sm text-gold">
                      {run.rank ?? "–"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
