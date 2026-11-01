"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { PixelSprite, spriteForWeakness, type SpriteKind } from "@/components/brand/PixelSprite";
import QuestPath from "@/components/game/QuestPath";
import { authJson } from "@/lib/api/client";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { WEAKNESS_LABELS } from "@/lib/labels";
import { BOSS_BY_DIMENSION, WEAKNESS_DIMENSION, getDungeonTier } from "@/game/map/buildFloorPlan";
import type { DungeonDimension, WeaknessType } from "@/lib/domain/types";
import { BOSS_ROSTER } from "@/lib/monsters";

const FLOOR_SPRITE: Record<DungeonDimension, SpriteKind> = {
  gap: "gap",
  align: "aligner",
  method: "methodologist",
  audit: "auditor",
  ghost: "references",
  throne: "sir",
};

const FLOOR_ORDER: DungeonDimension[] = ["gap", "align", "method", "audit", "ghost", "throne"];

interface FindingRow {
  id: string;
  weakness_type: string;
  claim_id: string | null;
  severity: number;
  severity_source: string;
  centrality: number;
  confidence: number;
  detector: "code" | "llm";
  evidence_quote: string;
  status: string;
  rank: number | null;
  version: string;
}

interface FindingsPayload {
  job: {
    id: string;
    research_map_id: string;
    status: "queued" | "running" | "done" | "failed";
    step: string | null;
    steps_done: number;
    steps_total: number | null;
    error: string | null;
    timings: Record<string, number>;
    discarded: Record<string, unknown>;
  };
  map: { id: string; manuscript_id: string; status: string };
  findings: FindingRow[];
}

export default function FindingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [payload, setPayload] = useState<FindingsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("Memuat...");
  const startedRef = useRef(false);

  const load = useCallback(async (): Promise<FindingsPayload> => {
    const result = await authJson<FindingsPayload>(`/api/recon/${params.id}`);
    setPayload(result);
    return result;
  }, [params.id]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const supabase = getBrowserSupabase();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.replace("/login");
          return;
        }
        if (startedRef.current) return;
        startedRef.current = true;

        let current = await load();
        if (cancelled) return;

        while (current.job.status !== "done" && current.job.status !== "failed") {
          setProgress(
            `Tahap ${current.job.step ?? "-"} · ${current.job.steps_done}/${current.job.steps_total ?? 3}`,
          );
          const run = await authJson<{ job: FindingsPayload["job"]; done: boolean }>(
            `/api/recon/${current.job.id}/run`,
            { method: "POST" },
          );
          current = await load();
          if (cancelled) return;
          if (run.job.status === "failed") {
            throw new Error(run.job.error ?? "Recon gagal.");
          }
        }
        setProgress(current.job.status === "done" ? "Analisis selesai." : "Analisis gagal.");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat temuan.");
      }
    }

    void boot();
    return () => {
      cancelled = true;
      startedRef.current = false;
    };
  }, [load, router]);

  if (error) {
    return (
      <main className="dungeon-bg scanlines grid min-h-screen place-items-center px-6">
        <div className="pixel-panel max-w-md p-6 text-center">
          <p className="text-sm text-blood">{error}</p>
          <Link
            href="/dashboard"
            className="pixel-button mt-5 border-ridge text-bone hover:border-gold hover:text-gold"
          >
            Kembali ke arsip
          </Link>
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="dungeon-bg scanlines grid min-h-screen place-items-center">
        <div className="flex items-center gap-3 text-sm text-ash">
          <span className="h-2 w-2 animate-flicker bg-gold" />
          {progress}
        </div>
      </main>
    );
  }

  const done = payload.job.status === "done";
  const failed = payload.job.status === "failed";
  const severe = payload.findings.filter((finding) => finding.severity >= 3).length;
  const codeFindings = payload.findings.filter((finding) => finding.detector === "code").length;

  const dimensionCounts = new Map<DungeonDimension, number>();
  for (const finding of payload.findings) {
    const dimension =
      WEAKNESS_DIMENSION[finding.weakness_type as WeaknessType] ?? "audit";
    dimensionCounts.set(dimension, (dimensionCounts.get(dimension) ?? 0) + 1);
  }
  const activeDimensions = FLOOR_ORDER.filter(
    (dimension) =>
      dimension === "throne" ||
      (dimension === "ghost"
        ? payload.findings.some(
            (finding) => WEAKNESS_DIMENSION[finding.weakness_type as WeaknessType] === "ghost",
          )
        : (dimensionCounts.get(dimension) ?? 0) > 0),
  );
  const tier = getDungeonTier(
    payload.findings
      .filter((finding) => WEAKNESS_DIMENSION[finding.weakness_type as WeaknessType])
      .map((finding, index) => ({
        id: finding.id,
        weaknessType: finding.weakness_type as WeaknessType,
        severity: Math.min(3, Math.max(1, finding.severity)) as 1 | 2 | 3,
        centrality: Math.min(3, Math.max(1, finding.centrality)) as 1 | 2 | 3,
        confidence: finding.confidence,
        evidenceQuote: finding.evidence_quote,
        floor: 1 as const,
        rank: finding.rank ?? index + 1,
      })),
  );

  return (
    <main className="dungeon-bg scanlines min-h-screen">
      <header className="sticky top-0 z-30 border-b-2 border-void bg-void/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href={`/map/${payload.map.id}`} className="hover:opacity-90">
            <Logo />
          </Link>
          <Link
            href="/dashboard"
            className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ash hover:text-gold"
          >
            Arsip naskah
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <QuestPath current="recon" className="mb-8" />

        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Pos 03 · Recon bestiary</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-bone sm:text-5xl">
              Temuan.
            </h1>
            <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-ash">
              {done
                ? `${payload.findings.length} temuan, diurutkan berdasarkan severity, centrality, lalu confidence. Ini pintu masuk dungeon.`
                : failed
                  ? "Recon gagal. Periksa error lalu jalankan ulang."
                  : progress}
            </p>
          </div>

          {done && payload.findings.length > 0 ? (
            <Link
              href={`/play/${payload.job.id}`}
              className="pixel-button border-gold bg-gold text-void hover:bg-bone"
            >
              Pilih karakter →
            </Link>
          ) : null}
        </div>

        <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Summary label="Total" value={String(payload.findings.length)} tone="text-bone" />
          <Summary label="Severe" value={String(severe)} tone="text-blood" />
          <Summary label="Code" value={String(codeFindings)} tone="text-mana" />
          <Summary label="LLM" value={String(payload.findings.length - codeFindings)} tone="text-gold" />
        </div>

        {done && payload.findings.length > 0 ? (
          <section className="mt-6 overflow-hidden border-2 border-void bg-[#0a0f14]/80 shadow-[inset_0_0_0_1px_#34424e]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-void bg-tomb/70 px-4 py-3">
              <div>
                <p className="font-pixel text-[0.58rem] text-gold">Peta ekspedisi</p>
                <p className="mt-1 text-sm font-bold text-bone">
                  {activeDimensions.length} lantai · tingkat {tier}
                </p>
              </div>
              <span className="pixel-chip border-gold/40 text-gold">
                {payload.findings.length} ruang bertarung
              </span>
            </div>
            <ol className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeDimensions.map((dimension, index) => {
                const boss = BOSS_ROSTER[BOSS_BY_DIMENSION[dimension]];
                const count = dimensionCounts.get(dimension) ?? 0;
                return (
                  <li
                    key={dimension}
                    className="flex items-center gap-3 border border-ridge/60 bg-void/50 p-2"
                  >
                    <span className="tile-floor grid h-12 w-12 shrink-0 place-items-center border border-void">
                      <PixelSprite kind={FLOOR_SPRITE[dimension]} size={38} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-pixel text-[0.5rem] text-ash">
                        LANTAI {String(index + 1).padStart(2, "0")}
                      </p>
                      <p className="truncate text-xs font-bold text-bone">
                        {boss?.name ?? "Eldravos"}
                      </p>
                      <p className="text-[0.62rem] uppercase tracking-[0.06em] text-ash/75">
                        {dimension === "throne"
                          ? "Sidang akhir"
                          : dimension === "ghost"
                            ? `${count || "—"} entri`
                            : `${count} temuan`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {failed ? (
          <p className="mt-6 border border-blood/40 bg-blood/10 p-4 text-xs text-blood">{payload.job.error}</p>
        ) : null}

        {!done && !failed ? (
          <div className="pixel-panel mt-7 p-5">
            <div className="flex items-center justify-between text-[0.72rem] uppercase tracking-[0.16em] text-ash">
              <span>{progress}</span>
              <span className="animate-flicker text-gold">●</span>
            </div>
            <div className="bar-track mt-3">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.max(
                    4,
                    Math.round(
                      ((payload.job.steps_done || 1) / (payload.job.steps_total ?? 3)) * 100,
                    ),
                  )}%`,
                }}
              />
            </div>
            <p className="mt-3 text-[0.8rem] leading-5 text-ash">
              Verifikasi referensi → detektor kode → detektor LLM. Jangan tutup halaman.
            </p>
          </div>
        ) : null}

        {done && payload.findings.length === 0 ? (
          <div className="pixel-panel mt-7 p-5">
            <p className="text-sm text-bone">Tidak ada temuan otomatis.</p>
            <p className="mt-2 text-xs leading-6 text-ash">
              Bukan berarti naskah sempurna. Recon hanya menandai yang bisa dibuktikan dari
              teks dan referensi yang tersedia.
            </p>
          </div>
        ) : null}

        <ol className="mt-6 space-y-3">
          {payload.findings.map((finding) => (
            <li key={finding.id} className="pixel-panel-soft group flex overflow-hidden">
              <div className="tile-floor relative flex w-[4.5rem] shrink-0 items-end justify-center border-r-2 border-void px-2 pb-3 pt-5 sm:w-24">
                <span className="absolute left-2 top-2 font-pixel text-[0.55rem] text-ash/80">
                  #{String(finding.rank ?? 0).padStart(2, "0")}
                </span>
                <PixelSprite
                  kind={spriteForWeakness(finding.weakness_type)}
                  size={58}
                  className="transition-transform duration-200 group-hover:-translate-y-1"
                />
              </div>

              <div className="min-w-0 flex-1 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold leading-6 text-bone">
                      {WEAKNESS_LABELS[finding.weakness_type] ?? finding.weakness_type}
                    </h2>
                    <p className="mt-1 text-[0.64rem] font-bold uppercase tracking-[0.07em] text-ash">
                      {finding.detector} · severity {finding.severity} · centrality{" "}
                      {finding.centrality} · confidence {Math.round(finding.confidence * 100)}%
                    </p>
                  </div>
                  <span className={`pixel-chip ${severityTone(finding.severity)}`}>
                    S{finding.severity}
                  </span>
                </div>

                <blockquote className="mt-3 border-l-2 border-gold/60 bg-void/45 py-2 pl-3 text-sm leading-6 text-ash">
                  “{finding.evidence_quote}”
                </blockquote>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash">
                      Ancaman
                    </span>
                    <span className="flex gap-1" aria-label={`Severity ${finding.severity} dari 3`}>
                      {[1, 2, 3].map((level) => (
                        <span
                          key={level}
                          className={`h-2 w-6 border border-void ${level <= finding.severity ? severityBar(finding.severity) : "bg-ridge/50"}`}
                        />
                      ))}
                    </span>
                  </div>
                  <span className="text-[0.62rem] font-bold uppercase tracking-[0.07em] text-ash/60">
                    {finding.status} · {finding.severity_source} · {finding.version}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>

        {done && payload.findings.length > 0 ? (
          <div className="pixel-panel pixel-panel-gold mt-8 flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-[0.66rem] uppercase tracking-[0.18em] text-gold">Gerbang dungeon</p>
              <p className="mt-1 text-lg font-bold text-bone">Peta sudah terbentuk.</p>
              <p className="mt-1 text-xs text-ash">
                {payload.findings.length} temuan jadi ruang. Bawa argumenmu.
              </p>
            </div>
            <Link href={`/play/${payload.job.id}`} className="pixel-button border-gold bg-gold text-void hover:bg-bone">
              Pilih karakter
            </Link>
          </div>
        ) : null}

        {done ? (
          <div className="mt-10 border-t border-ridge/50 pt-5 text-[0.72rem] uppercase tracking-[0.12em] text-ash/60">
            <p>
              Waktu:{" "}
              {Object.entries(payload.job.timings)
                .map(([step, ms]) => `${step} ${ms}ms`)
                .join(" · ") || "—"}
            </p>
            <p className="mt-1">Dibuang: {JSON.stringify(payload.job.discarded)}</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="border border-ridge/60 bg-void/50 px-3 py-2 shadow-pixel-sm">
      <p className={`font-pixel text-xl font-bold leading-none ${tone}`}>{value}</p>
      <p className="mt-2 text-[0.6rem] font-bold uppercase tracking-[0.07em] text-ash">{label}</p>
    </div>
  );
}

function severityTone(severity: number): string {
  if (severity >= 3) return "border-blood/40 bg-blood/10 text-blood";
  if (severity === 2) return "border-ember/40 bg-ember/10 text-ember";
  return "border-gold/30 bg-gold/5 text-gold";
}

function severityBar(severity: number): string {
  if (severity >= 3) return "bg-blood";
  if (severity === 2) return "bg-ember";
  return "bg-gold";
}
