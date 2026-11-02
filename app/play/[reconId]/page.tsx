"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { PixelSprite } from "@/components/brand/PixelSprite";
import EncounterOverlay from "@/components/encounter/EncounterOverlay";
import GameHud from "@/components/hud/GameHud";
import Minimap from "@/components/hud/Minimap";
import { HEARTS_START } from "@/lib/balance";
import LoadoutScreen from "@/components/loadout/LoadoutScreen";
import FloorIntro from "@/components/game/FloorIntro";
import PauseMenu from "@/components/game/PauseMenu";
import DungeonEntry from "@/components/game/DungeonEntry";
import { heartsForLoadout, isValidLoadout, type Loadout } from "@/lib/loadout";
import { getMonsterDisplayName } from "@/lib/monsters";
import type { SpriteKind } from "@/components/brand/PixelSprite";
import { bus } from "@/game/bus";
import { authJson } from "@/lib/api/client";
import { generateFloorFromPlan } from "@/game/map/generateFloor";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type {
  FindingStub,
  FloorMap,
  FloorPlan,
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

interface DungeonPlanPayload {
  title: string;
  tier: string;
  floors: FloorPlan[];
  source: string;
  model: string | null;
}

interface ActiveRunPayload {
  run: null | {
    id: string;
    characterSlug: string | null;
    weaponSlug: string | null;
    hearts: number;
    pointsTotal: number;
    currentFloor: number;
    progress: { resolved?: string[] } | null;
    dungeonTitle: string | null;
    floorCount: number | null;
  };
}

const FLOOR_SPRITE: Record<string, SpriteKind> = {
  gap: "gap",
  align: "aligner",
  method: "methodologist",
  audit: "auditor",
  ghost: "references",
  throne: "sir",
};

const FLOOR_NAMES: Record<string, string> = {
  gap: "Veylith · Gap Hunter",
  align: "Draeven · The Aligner",
  method: "Kryvax · Methodologist",
  audit: "Morvane · The Auditor",
  ghost: "Nyxara · Ghost Library",
  throne: "Eldravos · Ancient Sovereign",
};

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
  const [plans, setPlans] = useState<FloorPlan[]>([]);
  const [floorIndex, setFloorIndex] = useState(0);
  const [findingMeta, setFindingMeta] = useState<Record<string, FindingMeta>>({});
  const [runComplete, setRunComplete] = useState(false);
  const [runResult, setRunResult] = useState<{ pointsTotal: number; maxPoints: number; rank: string } | null>(null);
  const [researchMapId, setResearchMapId] = useState("");
  const [dungeonTitle, setDungeonTitle] = useState("");
  const [dungeonTier, setDungeonTier] = useState("");
  const [runId, setRunId] = useState("");
  const [points, setPoints] = useState(0);
  const [starting, setStarting] = useState(false);
  const [hearts, setHearts] = useState(HEARTS_START);
  const [floorStartHearts, setFloorStartHearts] = useState(HEARTS_START);
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFloorIntro, setShowFloorIntro] = useState(false);
  const [paused, setPaused] = useState(false);
  const [inEncounter, setInEncounter] = useState(false);
  const [entryPhase, setEntryPhase] = useState<"idle" | "loading" | "enter">("idle");
  const [pendingCharacter, setPendingCharacter] = useState<Loadout["characterSlug"]>("arka");
  const [resolvedKeys, setResolvedKeys] = useState<string[]>([]);
  const [doorNotice, setDoorNotice] = useState(false);

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
        const findings = recon.findings
          .filter((finding) => KNOWN_TYPES.has(finding.weakness_type as WeaknessType))
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

        const dungeon = await authJson<DungeonPlanPayload>("/api/dungeon/plan", {
          method: "POST",
          body: JSON.stringify({ researchMapId: recon.map.id }),
        });
        if (dungeon.floors.length === 0) {
          throw new Error("Cartographer tidak menghasilkan lantai.");
        }
        const plans = dungeon.floors;
        const firstPlan = plans[0]!;
        const generated = generateFloorFromPlan(firstPlan, 20261101);
        const findingMeta: Record<string, FindingMeta> = {};
        for (const finding of findings) {
          findingMeta[finding.id] = {
            weaknessType: finding.weaknessType,
            evidenceQuote: finding.evidenceQuote,
          };
        }

        const active = await authJson<ActiveRunPayload>(
          `/api/run/active?researchMapId=${recon.map.id}`,
        );

        setResearchMapId(recon.map.id);
        setDungeonTitle(dungeon.title);
        setDungeonTier(dungeon.tier);
        setPlans(plans);
        setFindingMeta(findingMeta);

        if (active.run) {
          const rawLoadout = {
            characterSlug: active.run.characterSlug ?? "arka",
            weaponSlug: active.run.weaponSlug ?? "pedang_sitasi",
          } as Loadout;
          const resumeLoadout = isValidLoadout(rawLoadout.characterSlug, rawLoadout.weaponSlug)
            ? rawLoadout
            : ({ characterSlug: "arka", weaponSlug: "pedang_sitasi" } as Loadout);
          const resumeIndex = Math.min(
            Math.max(0, (active.run.currentFloor ?? 1) - 1),
            plans.length - 1,
          );
          const keys = Array.isArray(active.run.progress?.resolved)
            ? active.run.progress.resolved.filter((key): key is string => typeof key === "string")
            : [];

          const resumedFloor = generateFloorFromPlan(plans[resumeIndex]!, 20261101 + resumeIndex);
          setLoadout(resumeLoadout);
          setPendingCharacter(resumeLoadout.characterSlug);
          setRunId(active.run.id);
          setPoints(active.run.pointsTotal);
          setHearts(active.run.hearts);
          setFloorStartHearts(active.run.hearts);
          setFloorIndex(resumeIndex);
          setResolvedKeys(keys);
          setFloorMap({ ...resumedFloor, findingMeta });
          setShowFloorIntro(false);
          setEntryPhase("enter");
          setLoading(false);
          return;
        }

        setFloorIndex(0);
        setFloorMap({ ...generated, findingMeta });
        setShowFloorIntro(true);
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

  const startRun = useCallback(
    async (selected: Loadout) => {
      setStarting(true);
      setError(null);
      try {
        const data = await authJson<{ runId: string; pointsTotal: number; hearts: number }>(
          "/api/run/start",
          {
            method: "POST",
            body: JSON.stringify({
              researchMapId,
              characterSlug: selected.characterSlug,
              weaponSlug: selected.weaponSlug,
              dungeonTitle,
              dungeonTier,
              floorCount: plans.length,
            }),
          },
        );
        setLoadout(selected);
        setRunId(data.runId);
        setPoints(data.pointsTotal);
        setHearts(data.hearts);
        setFloorStartHearts(data.hearts);
        setShowFloorIntro(false);
        setEntryPhase("enter");
      } catch (err) {
        setEntryPhase("idle");
        setError(err instanceof Error ? err.message : "Gagal memulai run.");
      } finally {
        setStarting(false);
      }
    },
    [researchMapId, dungeonTitle, dungeonTier, plans.length],
  );

  const persistProgress = useCallback(
    async (currentFloor: number, keys: string[]) => {
      if (!runId) return;
      try {
        await authJson("/api/run/progress", {
          method: "POST",
          body: JSON.stringify({ runId, currentFloor, resolvedKeys: keys }),
        });
      } catch {
        // Progress is saved again on the next encounter/floor transition.
      }
    },
    [runId],
  );

  const advanceFloor = useCallback(async () => {
    if (!runId) return;
    const currentFloor = plans[floorIndex]?.floorOrder ?? floorIndex + 1;
    const noHeartLost = hearts >= floorStartHearts;
    try {
      const floorPoints = await authJson<{ pointsTotal: number }>("/api/run/floor", {
        method: "POST",
        body: JSON.stringify({
          runId,
          floorOrder: currentFloor,
          noHeartLost,
          flawless: false,
        }),
      });
      setPoints(floorPoints.pointsTotal);
    } catch {
      // Still allow descending; points are recoverable from the server later.
    }

    const next = floorIndex + 1;
    if (next >= plans.length) {
      try {
        const result = await authJson<{ pointsTotal: number; maxPoints: number; rank: string }>(
          "/api/run/finish",
          { method: "POST", body: JSON.stringify({ runId }) },
        );
        setRunResult(result);
        setPoints(result.pointsTotal);
      } catch {
        setRunResult(null);
      }
      setRunComplete(true);
      return;
    }

    const generated = generateFloorFromPlan(plans[next]!, 20261101 + next);
    setFloorIndex(next);
    setFloorMap({ ...generated, findingMeta });
    setFloorStartHearts(hearts);
    setShowFloorIntro(true);
    void persistProgress(plans[next]!.floorOrder, resolvedKeys);
  }, [plans, findingMeta, floorIndex, runId, hearts, floorStartHearts, persistProgress, resolvedKeys]);

  useEffect(() => {
    const onEncounterEnd = (event: {
      encounterKey?: string;
      result: "won" | "conceded" | "disputed" | "fled";
    }) => {
      if (!event.encounterKey || event.result === "fled") return;
      setResolvedKeys((current) => {
        const next = [...new Set([...current, event.encounterKey!])];
        void persistProgress(floorIndex + 1, next);
        return next;
      });
    };

    const onFloorRetry = () => {
      const floorOrder = plans[floorIndex]?.floorOrder ?? floorIndex + 1;
      setResolvedKeys((current) => {
        const next = current.filter((key) => !key.startsWith(`f${floorOrder}-`));
        void persistProgress(floorOrder, next);
        return next;
      });
    };

    bus.on("encounter:end", onEncounterEnd);
    bus.on("floor:retry", onFloorRetry);
    return () => {
      bus.off("encounter:end", onEncounterEnd);
      bus.off("floor:retry", onFloorRetry);
    };
  }, [persistProgress, floorIndex, plans]);

  useEffect(() => {
    bus.on("stairs:reach", advanceFloor);
    return () => bus.off("stairs:reach", advanceFloor);
  }, [advanceFloor]);

  useEffect(() => {
    if (entryPhase !== "enter") return;
    const timer = window.setTimeout(() => setEntryPhase("idle"), 1900);
    return () => window.clearTimeout(timer);
  }, [entryPhase]);

  useEffect(() => {
    const onDoorLocked = () => {
      setDoorNotice(true);
      window.setTimeout(() => setDoorNotice(false), 2200);
    };
    bus.on("door:locked", onDoorLocked);
    return () => bus.off("door:locked", onDoorLocked);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
    void request?.().catch(() => {});
  }, []);

  const beginRun = useCallback(
    (selected: Loadout) => {
      setPendingCharacter(selected.characterSlug);
      setEntryPhase("loading");
      if (typeof document !== "undefined" && !document.fullscreenElement) {
        const root = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
        };
        const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
        void request?.().catch(() => {});
      }
      void startRun(selected);
    },
    [startRun],
  );

  const roomCount = useMemo(() => floorMap?.rooms.length ?? 0, [floorMap]);
  const activePlan = plans[floorIndex];
  const floorName = activePlan ? (FLOOR_NAMES[activePlan.dimension] ?? "Lantai") : "Lantai";
  const motionLocked = showFloorIntro || paused || entryPhase !== "idle";

  useEffect(() => {
    const onStart = () => setInEncounter(true);
    const onEnd = () => setInEncounter(false);
    bus.on("encounter:start", onStart);
    bus.on("encounter:end", onEnd);
    return () => {
      bus.off("encounter:start", onStart);
      bus.off("encounter:end", onEnd);
    };
  }, []);

  useEffect(() => {
    if (motionLocked) bus.emit("game:pause");
    else bus.emit("game:resume");
  }, [motionLocked]);

  useEffect(() => {
    if (!loadout || runComplete) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (inEncounter || showFloorIntro) return;
      event.preventDefault();
      setPaused((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loadout, runComplete, inEncounter, showFloorIntro]);

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

  if (entryPhase === "loading" && !loadout) {
    return (
      <DungeonEntry
        phase="loading"
        dungeonTitle={dungeonTitle || "Dungeon naskah"}
        characterSlug={pendingCharacter}
        floorLabel={`Lantai ${floorIndex + 1} · ${floorName}`}
      />
    );
  }

  if (!loadout) {
    return <LoadoutScreen onStart={beginRun} />;
  }

  if (runComplete) {
    return (
      <main className="dungeon-bg scanlines grid min-h-screen place-items-center px-6 py-10">
        <div className="game-screen-in pixel-panel pixel-panel-gold w-full max-w-md p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center border-2 border-void bg-tomb">
            <LogoMark size={36} />
          </div>
          <p className="mt-4 font-pixel text-[0.6rem] text-gold">Ekspedisi selesai</p>
          <h1 className="mt-2 text-2xl font-bold text-bone">
            {dungeonTitle || "Dungeon naskah"}
          </h1>
          {runResult ? (
            <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-4 border-2 border-void bg-void/55 p-4 text-left">
              <div className="grid h-20 w-20 place-items-center border-2 border-gold bg-gold/10">
                <span className="font-pixel text-3xl font-bold text-gold">{runResult.rank}</span>
              </div>
              <div>
                <p className="font-pixel text-[0.54rem] text-ash">RANK EKSPEDISI</p>
                <p className="mt-1 text-lg font-bold text-bone">
                  {runResult.pointsTotal} / {runResult.maxPoints} poin
                </p>
                <div className="bar-track mt-2">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${Math.max(
                        2,
                        Math.round(
                          (runResult.pointsTotal / Math.max(1, runResult.maxPoints)) * 100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-5 border-2 border-void bg-void/55 p-3 text-sm text-ash">
              Poin run ini belum tersimpan. Laporan tetap bisa dibuka.
            </p>
          )}
          <p className="mt-4 text-sm leading-6 text-ash">
            Semua lantai sudah ditelusuri. Buka laporan untuk melihat peta kelemahan naskah.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link
              href={`/findings/${params.reconId}`}
              className="pixel-button border-gold bg-gold text-void hover:bg-bone"
            >
              Lihat laporan
            </Link>
            <Link
              href="/dashboard"
              className="pixel-button border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold"
            >
              Kembali ke kamp
            </Link>
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
      <PhaserGame
        floorMap={floorMap}
        characterSlug={loadout.characterSlug}
        resolvedKeys={resolvedKeys}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          boxShadow: "inset 0 0 70px rgba(7,6,11,0.52), inset 0 0 0 2px rgba(240,192,90,0.18)",
        }}
        aria-hidden="true"
      />
      <GameHud
        floorMap={floorMap}
        hearts={hearts}
        heartsMax={heartsForLoadout(loadout.characterSlug)}
        points={points}
      />

      <div className="pointer-events-none absolute left-1/2 top-2 z-10 hidden w-[min(44vw,26rem)] -translate-x-1/2 border-2 border-void bg-[#0a0f14]/90 px-3 py-1.5 text-center shadow-[inset_0_0_0_1px_#34424e,4px_4px_0_rgba(0,0,0,0.35)] md:block">
        <p className="truncate font-pixel text-[0.5rem] uppercase tracking-[0.08em] text-gold">
          {dungeonTitle || "Dungeon naskah"}
        </p>
        <p className="mt-0.5 truncate text-[0.66rem] font-bold text-bone">{floorName}</p>
        <p className="mt-0.5 text-[0.56rem] font-bold uppercase tracking-[0.08em] text-ash">
          Uji {activePlan?.monsterCount ?? roomCount} musuh · {roomCount} ruang
        </p>
      </div>

      <Minimap floorMap={floorMap} />
      <EncounterOverlay
        hearts={hearts}
        onHeartsChange={setHearts}
        researchMapId={researchMapId}
        loadout={loadout}
        heartsMax={heartsForLoadout(loadout.characterSlug)}
        runId={runId}
        onPointsChange={setPoints}
      />
      <div className="absolute right-2 top-2 z-10 flex flex-wrap items-center justify-end gap-1 text-right text-[0.62rem] font-bold uppercase tracking-[0.07em] text-ash">
        <span className="border-2 border-void bg-void/90 px-2 py-1 shadow-[inset_0_0_0_1px_#34424e]">
          Lantai {floorIndex + 1}/{plans.length || 1} · {roomCount} ruang
        </span>
        <button
          type="button"
          onClick={() => bus.emit("camera:zoom", { delta: -0.5 })}
          className="border-2 border-void bg-void/90 px-2 py-1 shadow-[inset_0_0_0_1px_#34424e] hover:text-gold"
          aria-label="Perkecil tampilan dungeon"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => bus.emit("camera:zoom", { delta: 0.5 })}
          className="border-2 border-void bg-void/90 px-2 py-1 shadow-[inset_0_0_0_1px_#34424e] hover:text-gold"
          aria-label="Perbesar tampilan dungeon"
        >
          +
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="border-2 border-void bg-void/90 px-2 py-1 shadow-[inset_0_0_0_1px_#34424e] hover:text-gold"
        >
          Layar
        </button>
        <button
          type="button"
          onClick={() => setPaused(true)}
          className="border-2 border-void bg-void/90 px-2 py-1 shadow-[inset_0_0_0_1px_#34424e] hover:text-gold"
        >
          Jeda
        </button>
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
        WASD / panah · scroll zoom · tabrak monster · Esc jeda
      </p>

      {doorNotice ? (
        <div className="game-rise absolute bottom-12 left-1/2 z-30 -translate-x-1/2 border-2 border-ember/70 bg-[#0a0f14]/95 px-3 py-2 text-center shadow-[4px_4px_0_#05080b]">
          <p className="font-pixel text-[0.52rem] text-ember">PINTU TERKUNCI</p>
          <p className="mt-1 text-[0.72rem] leading-5 text-bone">
            Selesaikan semua monster di ruangan ini dulu untuk membuka pintu berikutnya.
          </p>
        </div>
      ) : null}

      {showFloorIntro && activePlan ? (
        <FloorIntro
          floorOrder={floorIndex + 1}
          floorTotal={plans.length}
          floorName={floorName}
          bossName={getMonsterDisplayName(activePlan.bossSlug)}
          bossSprite={FLOOR_SPRITE[activePlan.dimension] ?? "sir"}
          theme={activePlan.theme}
          lore={activePlan.lore}
          roomCount={roomCount}
          monsterCount={activePlan.monsterCount}
          onEnter={() => setShowFloorIntro(false)}
        />
      ) : null}

      {paused ? (
        <PauseMenu
          dungeonTitle={dungeonTitle || "Dungeon naskah"}
          floorLabel={`Lantai ${floorIndex + 1}/${plans.length} · ${floorName}`}
          points={points}
          hearts={hearts}
          heartsMax={heartsForLoadout(loadout.characterSlug)}
          loadout={loadout}
          onResume={() => setPaused(false)}
        />
      ) : null}

      {entryPhase === "enter" ? (
        <DungeonEntry
          phase="enter"
          dungeonTitle={dungeonTitle || "Dungeon naskah"}
          characterSlug={loadout.characterSlug}
          floorLabel={`Lantai ${floorIndex + 1} · ${floorName}`}
        />
      ) : null}
    </div>
  );
}
