"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import QuestPath from "@/components/game/QuestPath";
import DungeonMapPreview from "@/components/game/DungeonMapPreview";
import ReconOverlay from "@/components/manuscript/ReconOverlay";
import { authJson } from "@/lib/api/client";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { buildFloorPlan, getDungeonTier, WEAKNESS_DIMENSION } from "@/game/map/buildFloorPlan";
import type { FindingStub, WeaknessType } from "@/lib/domain/types";

interface MapPayload {
  manuscript: {
    id: string;
    title: string;
    stage: "proposal" | "skripsi" | "jurnal";
  };
  map: {
    id: string;
    version: number;
    status: "draft" | "confirmed";
  };
  citations: Array<{ id: string }>;
  recon: { id: string; status: string } | null;
}

interface ReconPayload {
  job: {
    id: string;
    status: "queued" | "running" | "done" | "failed";
    step: string | null;
    steps_done: number;
    steps_total: number | null;
    error: string | null;
  };
  findings: Array<{
    id: string;
    weakness_type: string;
    severity: number;
    centrality: number;
    confidence: number;
    evidence_quote: string;
    rank: number | null;
  }>;
}

type FindingRow = ReconPayload["findings"][number];

const KNOWN_TYPES = new Set(Object.keys(WEAKNESS_DIMENSION));

function toStubs(findings: readonly FindingRow[]): FindingStub[] {
  return findings
    .filter((finding) => KNOWN_TYPES.has(finding.weakness_type))
    .map((finding, index) => ({
      id: finding.id,
      weaknessType: finding.weakness_type as WeaknessType,
      severity: Math.min(3, Math.max(1, finding.severity)) as 1 | 2 | 3,
      centrality: Math.min(3, Math.max(1, finding.centrality)) as 1 | 2 | 3,
      confidence: finding.confidence,
      evidenceQuote: finding.evidence_quote,
      floor: 1 as const,
      rank: finding.rank ?? index + 1,
    }));
}

export default function MapPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [payload, setPayload] = useState<MapPayload | null>(null);
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState("Membuka peta...");
  const [step, setStep] = useState<string | null>(null);
  const [stepsDone, setStepsDone] = useState(0);
  const [stepsTotal, setStepsTotal] = useState(3);

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

        const mapPayload = await authJson<MapPayload>(`/api/research-maps/${params.id}`);
        if (cancelled) return;
        setPayload(mapPayload);

        let recon = mapPayload.recon;
        if (!recon) {
          setProgressText("Mengunci peta...");
          const confirmed = await authJson<{ reconJobId: string | null }>(
            `/api/research-maps/${params.id}/confirm`,
            { method: "POST" },
          );
          if (!confirmed.reconJobId) throw new Error("Recon tidak bisa dimulai.");
          recon = { id: confirmed.reconJobId, status: "queued" };
        }

        setRunning(true);
        let current = await authJson<ReconPayload>(`/api/recon/${recon.id}`);
        if (cancelled) return;
        setFindings(current.findings);
        setStepsDone(current.job.steps_done);
        setStepsTotal(current.job.steps_total ?? 3);
        setStep(current.job.step);
        setProgressText(`Tahap ${current.job.step ?? "-"}`);
        if (current.job.status === "failed") {
          throw new Error(current.job.error ?? "Recon gagal.");
        }

        while (current.job.status !== "done") {
          const run = await authJson<{ job: ReconPayload["job"]; done: boolean }>(
            `/api/recon/${recon.id}/run`,
            { method: "POST" },
          );
          if (cancelled) return;
          setStep(run.job.step);
          setStepsDone(run.job.steps_done);
          setStepsTotal(run.job.steps_total ?? 3);
          setProgressText(`Tahap ${run.job.step ?? "-"}`);
          current = await authJson<ReconPayload>(`/api/recon/${recon.id}`);
          if (cancelled) return;
          setFindings(current.findings);
          if (run.job.status === "failed") {
            throw new Error(run.job.error ?? "Recon gagal.");
          }
        }

        setRunning(false);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Gagal menyiapkan peta.");
          setRunning(false);
          setLoading(false);
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  const stubs = useMemo(() => toStubs(findings), [findings]);
  const floors = useMemo(
    () => buildFloorPlan(stubs, (payload?.citations.length ?? 0) > 0),
    [stubs, payload?.citations.length],
  );
  const tier = useMemo(() => getDungeonTier(stubs), [stubs]);
  const reconId = payload?.recon?.id ?? null;

  if (error) {
    return (
      <main className="dungeon-bg scanlines grid min-h-screen place-items-center px-6">
        <div className="pixel-panel max-w-md p-6 text-center">
          <p className="font-pixel text-[0.6rem] text-gold">Peta gagal ditempa</p>
          <p className="mt-3 text-sm leading-6 text-blood">{error}</p>
          <Link
            href="/dashboard"
            className="pixel-button mt-5 border-ridge text-bone hover:border-gold hover:text-gold"
          >
            Kembali ke kamp
          </Link>
        </div>
      </main>
    );
  }

  if (loading || running) {
    return (
      <main className="dungeon-bg scanlines grid min-h-screen place-items-center">
        {running ? (
          <ReconOverlay
            step={step}
            stepsDone={stepsDone}
            stepsTotal={stepsTotal}
            progressText={progressText}
          />
        ) : (
          <div className="flex items-center gap-3 text-sm text-ash">
            <span className="h-2 w-2 animate-flicker bg-gold" />
            {progressText}
          </div>
        )}
      </main>
    );
  }

  if (!payload || !reconId) return null;

  return (
    <main className="dungeon-bg scanlines min-h-screen">
      <header className="sticky top-0 z-30 border-b-2 border-void bg-void/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/dashboard" className="hover:opacity-90">
            <Logo />
          </Link>
          <Link
            href="/dashboard"
            className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ash hover:text-gold"
          >
            Kembali ke kamp
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <QuestPath current="loadout" className="mb-6" />
        <DungeonMapPreview
          title={payload.manuscript.title}
          tier={tier}
          floors={floors}
          findingCount={stubs.length}
          citationCount={payload.citations.length}
          href={`/play/${reconId}`}
        />
      </div>
    </main>
  );
}
