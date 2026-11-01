"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { PixelSprite } from "@/components/brand/PixelSprite";
import EncounterOverlay from "@/components/encounter/EncounterOverlay";
import GameHud from "@/components/hud/GameHud";
import Minimap from "@/components/hud/Minimap";
import { HEARTS_START } from "@/lib/balance";
import { authJson } from "@/lib/api/client";
import { generateFloor } from "@/game/map/generateFloor";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type {
  FindingStub,
  FloorMap,
  FindingMeta,
  WeaknessType,
} from "@/lib/domain/types";

const PhaserGame = dynamic(() => import("@/game/PhaserGame"), { ssr: false });

interface ReconPayload {
  job: { id: string; research_map_id: string; status: string; error: string | null };
  map: { id: string; manuscript_id: string; status: string };
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

interface SourcePayload {
  map: { source_text: string };
  citations: Array<{ raw_text: string }>;
}

const KNOWN_TYPES = new Set<WeaknessType>([
  "gap_unsupported",
  "gap_answered_by_own_refs",
  "claim_without_citation",
  "problem_objective_gap",
  "objective_rq_mismatch",
  "rq_method_mismatch",
  "sample_unreported",
  "generalization_beyond_sample",
  "limitation_missing",
  "conclusion_overclaim",
  "objective_without_finding",
  "abstract_result_mismatch",
]);

export default function PlayPage() {
  const params = useParams<{ reconId: string }>();
  const router = useRouter();
  const [floorMap, setFloorMap] = useState<FloorMap | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [citations, setCitations] = useState<string[]>([]);
  const [hearts, setHearts] = useState(HEARTS_START);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supabase = getBrowserSupabase();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.replace("/login");
          return;
        }

        const recon = await authJson<ReconPayload>(`/api/recon/${params.reconId}`);
        if (recon.job.status !== "done") {
          throw new Error("Analisis belum selesai. Buka halaman temuan dulu.");
        }
        const source = await authJson<SourcePayload>(`/api/research-maps/${recon.map.id}`);
        if (cancelled) return;

        const findings = recon.findings
          .filter((finding) => KNOWN_TYPES.has(finding.weakness_type as WeaknessType))
          .slice(0, 8)
          .map((finding, index): FindingStub => ({
            id: finding.id,
            weaknessType: finding.weakness_type as WeaknessType,
            severity: Math.min(3, Math.max(1, finding.severity)) as 1 | 2 | 3,
            centrality: Math.min(3, Math.max(1, finding.centrality)) as 1 | 2 | 3,
            confidence: finding.confidence,
            evidenceQuote: finding.evidence_quote,
            floor: 1,
            rank: finding.rank ?? index + 1,
          }));

        if (findings.length === 0) {
          throw new Error("Tidak ada temuan yang bisa dijadikan ruang.");
        }

        const generated = generateFloor(findings, 1, 20261101);
        const findingMeta: Record<string, FindingMeta> = {};
        for (const finding of findings) {
          findingMeta[finding.id] = {
            weaknessType: finding.weaknessType,
            evidenceQuote: finding.evidenceQuote,
          };
        }

        setSourceText(source.map.source_text);
        setCitations(source.citations.map((citation) => citation.raw_text));
        setFloorMap({ ...generated, findingMeta });
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Gagal memuat dungeon.");
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.reconId, router]);

  const roomCount = useMemo(() => floorMap?.rooms.length ?? 0, [floorMap]);

  if (error) {
    return (
      <main className="dungeon-bg scanlines grid min-h-screen place-items-center px-6">
        <div className="pixel-panel max-w-md p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center border-2 border-void bg-tomb">
            <LogoMark size={36} />
          </div>
          <p className="mt-4 font-pixel text-[0.6rem] text-gold">Dungeon terkunci</p>
          <p className="mt-3 text-sm leading-6 text-blood">{error}</p>
          <Link
            href={`/findings/${params.reconId}`}
            className="pixel-button mt-5 border-ridge text-bone hover:border-gold hover:text-gold"
          >
            Kembali ke temuan
          </Link>
        </div>
      </main>
    );
  }

  if (loading || !floorMap) {
    return (
      <main className="dungeon-bg scanlines grid min-h-screen place-items-center px-6">
        <div className="game-screen w-full max-w-sm p-4">
          <div className="game-screen-bar flex items-center justify-between px-2 py-2">
            <span className="font-pixel text-[0.55rem] text-gold">Loading run</span>
            <span className="h-2 w-2 animate-flicker bg-ember" />
          </div>
          <div className="tile-floor relative mt-4 h-44 overflow-hidden border-2 border-void">
            <div className="wall-stone absolute inset-x-0 top-0 h-8 border-b-2 border-void" />
            <div className="wall-stone absolute inset-x-0 bottom-0 h-7 border-t-2 border-void" />
            <span className="torch-flame absolute left-5 top-11" />
            <span className="torch-flame absolute right-5 top-11" />
            <PixelSprite kind="hero" size={70} className="absolute bottom-4 left-[25%] animate-walk-in" />
            <PixelSprite kind="sir" size={76} className="absolute bottom-4 right-[22%]" />
          </div>
          <div className="mt-4">
            <p className="font-pixel text-[0.58rem] text-gold">Menyiapkan dungeon</p>
            <p className="mt-2 text-sm leading-6 text-ash">Menyusun ruang dari temuan...</p>
            <div className="bar-track mt-3">
              <div className="bar-fill w-2/3" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div
      id="game-root"
      className="relative overflow-hidden bg-[#0D0F15]"
      style={{ width: "100vw", height: "100dvh" }}
    >
      <PhaserGame floorMap={floorMap} />
      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          boxShadow: "inset 0 0 90px rgba(7,6,11,0.75), inset 0 0 0 2px rgba(240,192,90,0.15)",
        }}
        aria-hidden="true"
      />
      <GameHud floorMap={floorMap} hearts={hearts} />
      <Minimap floorMap={floorMap} />
      <EncounterOverlay
        hearts={hearts}
        onHeartsChange={setHearts}
        sourceText={sourceText}
        knownCitations={citations}
      />
      <div className="absolute right-2 top-2 z-10 flex flex-wrap items-center justify-end gap-1 text-right text-[0.62rem] font-bold uppercase tracking-[0.07em] text-ash">
        <span className="border-2 border-void bg-void/90 px-2 py-1 shadow-[inset_0_0_0_1px_#34424e]">
          {roomCount} ruang
        </span>
        <Link
          href={`/findings/${params.reconId}`}
          className="border-2 border-void bg-void/90 px-2 py-1 shadow-[inset_0_0_0_1px_#34424e] hover:text-gold"
        >
          Temuan
        </Link>
        <Link
          href="/dashboard"
          className="border-2 border-void bg-void/90 px-2 py-1 shadow-[inset_0_0_0_1px_#34424e] hover:text-gold"
        >
          Naskah
        </Link>
      </div>
      <p className="absolute bottom-2 left-2 z-10 max-w-[55vw] border-2 border-void bg-void/85 px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.07em] text-ash shadow-[inset_0_0_0_1px_#34424e]">
        WASD / panah · tabrak monster untuk memulai
      </p>
    </div>
  );
}
