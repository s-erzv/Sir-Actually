"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { authJson } from "@/lib/api/client";

interface WeakLink {
  findingId: string;
  weaknessType: string;
  severity: number;
  status: string;
}

interface ReportPayload {
  run: {
    id: string;
    status: string;
    pointsTotal: number;
    rank: string | null;
    finishedAt: string | null;
    dungeonTitle: string | null;
  };
  pointsByKind: Record<string, number>;
  comprehension?: { passed: number; total: number };
  report: null | {
    readiness: {
      complete: boolean;
      total: number;
      defended: number;
      conceded: number;
      disputed: number;
      untested: number;
      ratio: number;
    };
    weakLinks: WeakLink[];
    comparison: null | {
      previousVersion: number;
      currentVersion: number;
      stillPresent: number;
      changed: number;
      newFindings: number;
    };
    untested: string[];
    generatedAt: string;
  };
}

const STATUS_LABEL: Record<string, string> = {
  defended: "Didefend",
  conceded: "Dikonced",
  disputed: "Disputed",
  untested: "Belum diuji",
};

const STATUS_COLOR: Record<string, string> = {
  defended: "text-moss border-moss/40 bg-moss/10",
  conceded: "text-gold border-gold/40 bg-gold/10",
  disputed: "text-ash border-ridge/50 bg-void/40",
  untested: "text-blood border-blood/40 bg-blood/10",
};

const POINT_LABEL: Record<string, string> = {
  monster_won: "Monster",
  treasure: "Harta",
  floor_cleared: "Lantai",
  no_heart_lost: "HP terjaga",
  flawless: "Flawless",
  streak: "Streak",
  loot: "Loot",
};

export default function ReportPage() {
  const params = useParams<{ runId: string }>();
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void authJson<ReportPayload>(`/api/run/report?runId=${params.runId}`)
      .then(setPayload)
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal membuka laporan."));
  }, [params.runId]);

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
        {error ? (
          <p className="border-2 border-blood/40 bg-blood/10 p-4 text-sm text-blood">{error}</p>
        ) : !payload ? (
          <p className="text-sm text-ash">Membuka laporan...</p>
        ) : !payload.report ? (
          <div className="border-2 border-ridge/60 bg-void/45 p-4 text-sm text-ash">
            Laporan belum tersedia untuk run ini.
          </div>
        ) : (
          <>
            <p className="eyebrow">Laporan akhir</p>
            <h1 className="mt-2 text-3xl font-bold text-bone">
              {payload.run.dungeonTitle ?? "Dungeon naskah"}
            </h1>
            <p className="mt-2 text-sm text-ash">
              Rank {payload.run.rank ?? "-"} · {payload.run.pointsTotal} koin ·{" "}
              {payload.report.readiness.complete ? "semua temuan diuji" : "masih ada yang belum diuji"}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Total temuan" value={payload.report.readiness.total} />
              <Stat label="Didefend" value={payload.report.readiness.defended} tone="text-moss" />
              <Stat label="Dikonced" value={payload.report.readiness.conceded} tone="text-gold" />
              <Stat label="Belum diuji" value={payload.report.readiness.untested} tone="text-blood" />
            </div>

            {payload.comprehension && payload.comprehension.total > 0 ? (
              <p className="mt-3 border-2 border-ridge/60 bg-void/45 px-3 py-2 text-[0.72rem] text-ash">
                Uji pemahaman: {payload.comprehension.passed} dari {payload.comprehension.total} klaim dijelaskan dengan baik.
                Ini bukan kelemahan naskah.
              </p>
            ) : null}

            <section className="mt-6 border-2 border-ridge/60 bg-void/45 p-4">
              <h2 className="font-pixel text-[0.56rem] uppercase tracking-[0.1em] text-gold">
                Rincian koin
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(payload.pointsByKind ?? {})
                  .filter(([, amount]) => amount > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([kind, amount]) => (
                    <span
                      key={kind}
                      className="flex items-center gap-2 border border-ridge/60 bg-void/50 px-2 py-1 text-[0.62rem] uppercase tracking-[0.06em] text-ash"
                    >
                      {POINT_LABEL[kind] ?? kind}
                      <strong className="font-pixel text-gold">{amount}</strong>
                    </span>
                  ))}
              </div>
            </section>

            {payload.report.comparison ? (
              <section className="mt-6 border-2 border-ridge/60 bg-void/45 p-4">
                <h2 className="font-pixel text-[0.56rem] uppercase tracking-[0.1em] text-gold">
                  Perbandingan versi {payload.report.comparison.previousVersion} →{" "}
                  {payload.report.comparison.currentVersion}
                </h2>
                <p className="mt-2 text-sm text-ash">
                  Masih ada {payload.report.comparison.stillPresent} · berubah{" "}
                  {payload.report.comparison.changed} · baru {payload.report.comparison.newFindings}.
                </p>
              </section>
            ) : null}

            <section className="mt-6 border-2 border-ridge/60 bg-void/45 p-4">
              <h2 className="font-pixel text-[0.56rem] uppercase tracking-[0.1em] text-gold">
                Peta kelemahan
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {payload.report.weakLinks.map((link) => (
                  <li
                    key={link.findingId}
                    className={`flex items-center justify-between gap-2 border px-3 py-2 text-[0.72rem] ${
                      STATUS_COLOR[link.status] ?? STATUS_COLOR.untested
                    }`}
                  >
                    <span className="truncate font-bold">
                      {link.weaknessType.replaceAll("_", " ")}
                    </span>
                    <span className="shrink-0 uppercase tracking-[0.06em]">
                      {STATUS_LABEL[link.status] ?? link.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, tone = "text-gold" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="border-2 border-ridge/50 bg-void/45 px-3 py-2 text-center">
      <p className={`font-pixel text-lg font-bold ${tone}`}>{value}</p>
      <p className="mt-1 text-[0.56rem] font-bold uppercase tracking-[0.07em] text-ash">
        {label}
      </p>
    </div>
  );
}
