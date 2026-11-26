"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { PixelSprite } from "@/components/brand/PixelSprite";
import { CharacterPortrait, MonsterPortrait } from "@/components/brand/Portrait";
import EncounterOverlay from "@/components/encounter/EncounterOverlay";
import GameHud from "@/components/hud/GameHud";
import Minimap from "@/components/hud/Minimap";
import TouchControls from "@/components/game/TouchControls";
import GhostLibrary from "@/components/game/GhostLibrary";
import { HEART_HP, HEARTS_START, MAX_QUESTIONS_BOSS, MAX_QUESTIONS_MINION } from "@/lib/balance";
import LoadoutScreen from "@/components/loadout/LoadoutScreen";
import FloorIntro from "@/components/game/FloorIntro";
import PauseMenu from "@/components/game/PauseMenu";
import DungeonEntry from "@/components/game/DungeonEntry";
import LandscapeGate from "@/components/game/LandscapeGate";
import ShopModal from "@/components/hud/ShopModal";
import { placeDwellers } from "@/lib/dungeon/dwellers";
import GameSettingsModal from "@/components/game/GameSettings";
import { DEFAULT_GAME_SETTINGS, readGameSettings, writeGameSettings, type GameSettings } from "@/lib/gameSettings";
import { getCharacter, heartsForLoadout, isValidLoadout, type Loadout } from "@/lib/loadout";
import { getMinionForRoom, getMonsterDisplayName } from "@/lib/monsters";
import type { GeneratedQuestion } from "@/lib/encounter/schema";
import type { SpriteKind } from "@/components/brand/PixelSprite";
import { bus } from "@/game/bus";
import { authJson } from "@/lib/api/client";
import { generateFloorFromPlan } from "@/game/map/generateFloor";
import { buildFloorPlan, getDungeonTier } from "@/game/map/buildFloorPlan";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type {
  FindingStub,
  FloorMap,
  FloorPlan,
  FindingMeta,
  WeaknessType,
} from "@/lib/domain/types";

const PhaserGame = dynamic(() => import("@/game/PhaserGame"), { ssr: false });

/** Best-effort landscape lock. Android Chrome honors it in fullscreen; iOS Safari ignores it. */
async function lockLandscape(): Promise<void> {
  try {
    const orientation = window.screen.orientation as ScreenOrientation & {
      lock?: (value: string) => Promise<void>;
    };
    await orientation?.lock?.("landscape");
  } catch {
    // Unsupported (iOS Safari) — the rotate gate still covers portrait.
  }
}

interface QuestionBankEncounter {
  encounterKey: string;
  findingId?: string;
  bossSlug: string;
  weaknessType: string;
  evidenceQuote?: string;
  isBoss: boolean;
  floorOrder: number;
  roomOrder: number;
  count: number;
}

interface ReconPayload {
  job: { id: string; research_map_id: string; status: string; error: string | null };
  map: { id: string; manuscript_id: string; status: string };
  citationCount?: number;
  dwellerCounts?: Record<string, number>;
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
    hp: number;
    hpMax: number;
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
  const [runResult, setRunResult] = useState<{
    pointsTotal: number;
    maxPoints: number;
    rank: string;
    comparison?: {
      previousVersion: number;
      currentVersion: number;
      stillPresent: number;
      changed: number;
      newFindings: number;
    } | null;
  } | null>(null);
  const [researchMapId, setResearchMapId] = useState("");
  const [dungeonTitle, setDungeonTitle] = useState("");
  const [dungeonTier, setDungeonTier] = useState("");
  const [runId, setRunId] = useState("");
  const [points, setPoints] = useState(0);
  const [starting, setStarting] = useState(false);
  const [hearts, setHearts] = useState(HEARTS_START);
  const [floorStartHearts, setFloorStartHearts] = useState(HEARTS_START);
  const [hp, setHp] = useState(HEARTS_START * HEART_HP);
  const [hpMax, setHpMax] = useState(HEARTS_START * HEART_HP);
  const [potions, setPotions] = useState(0);
  const [potionBusy, setPotionBusy] = useState(false);
  const potionPending = useRef(false);
  const [shopFloor, setShopFloor] = useState<number | null>(null);
  const [dwellerCounts, setDwellerCounts] = useState<Record<number, number>>({});
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFloorIntro, setShowFloorIntro] = useState(false);
  const [showGhostLibrary, setShowGhostLibrary] = useState(false);
  const ghostShownRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gameSettings, setGameSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
  const [inEncounter, setInEncounter] = useState(false);
  const [entryPhase, setEntryPhase] = useState<"idle" | "loading" | "enter">("idle");
  const [pendingCharacter, setPendingCharacter] = useState<Loadout["characterSlug"]>("arka");
  const [resolvedKeys, setResolvedKeys] = useState<string[]>([]);
  const [questionBank, setQuestionBank] = useState<Record<string, GeneratedQuestion[]>>({});
  const [doorNotice, setDoorNotice] = useState(false);
  const [doorOpened, setDoorOpened] = useState<number | null>(null);
  const [roomProgress, setRoomProgress] = useState<{ roomNumber: number; remaining: number; total: number } | null>(null);
  const [lootNotice, setLootNotice] = useState<string | null>(null);

  const prefetchFloorQuestions = useCallback(async (map: FloorMap, mapId: string, force = false) => {
    // Ghost questions must wait until Nyxara has injected the fake citation.
    if (map.dimension === "ghost" && !force) return;
    const encounters = map.rooms.flatMap((room): QuestionBankEncounter[] => {
      const roomIndex = parseInt(room.id.split("-r")[1] ?? "0", 10);
      const findingIds = room.findingIds?.length
        ? room.findingIds
        : room.findingId
          ? [room.findingId]
          : [];
      const count = room.isBoss ? MAX_QUESTIONS_BOSS : MAX_QUESTIONS_MINION;

      if (findingIds.length === 0) {
        if (room.kind !== "special") return [];
        const weaknessType: WeaknessType =
          room.bossSlug === "nyxara" ? "citation_claim_mismatch" : "conclusion_overclaim";
        return [
          {
            encounterKey: `${room.id}:0`,
            bossSlug: room.bossSlug ?? "boss",
            weaknessType,
            isBoss: room.isBoss,
            floorOrder: map.floorOrder,
            roomOrder: roomIndex,
            count,
          },
        ];
      }

      return findingIds.map((findingId, index) => {
        const meta = map.findingMeta?.[findingId];
        const bossSlug =
          room.kind === "minions"
            ? `minion-${getMinionForRoom(map.floorOrder, roomIndex).slug}`
            : (room.bossSlug ?? "boss");
        return {
          encounterKey: `${room.id}:${index}`,
          findingId,
          bossSlug,
          weaknessType: meta?.weaknessType ?? "gap_unsupported",
          evidenceQuote: meta?.evidenceQuote,
          isBoss: room.isBoss,
          floorOrder: map.floorOrder,
          roomOrder: roomIndex,
          count,
        };
      });
    });
    for (const dweller of map.dwellers ?? []) {
      encounters.push({
        encounterKey: `f${map.floorOrder}-r${dweller.roomOrder}:0`,
        bossSlug: `minion-${dweller.minionSlug}`,
        weaknessType: "comprehension",
        isBoss: false,
        floorOrder: map.floorOrder,
        roomOrder: dweller.roomOrder,
        count: 1,
      });
    }
    if (encounters.length === 0) return;

    try {
      const data = await authJson<{ questions: Record<string, GeneratedQuestion[]> }>(
        "/api/encounter/questions",
        {
          method: "POST",
          body: JSON.stringify({ researchMapId: mapId, encounters }),
        },
      );
      setQuestionBank((prev) => ({ ...prev, ...data.questions }));
    } catch {
      // Prefetch is best-effort; the single-question route still works.
    }
  }, []);

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

        const email = data.session.user.email ?? "";
        const displayName =
          (data.session.user.user_metadata?.display_name as string | undefined) ??
          (data.session.user.user_metadata?.full_name as string | undefined) ??
          email.split("@")[0];
        if (displayName) setPlayerName(displayName);

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

        // Build the deterministic plan immediately; AI theme/title loads in
        // the background and must never block entering the dungeon.
        const plans = buildFloorPlan(findings, (recon.citationCount ?? 0) > 0);
        if (plans.length === 0) {
          throw new Error("Cartographer tidak menghasilkan lantai.");
        }
        const firstPlan = plans[0]!;
        const generated = generateFloorFromPlan(firstPlan, 20261101);
        const counts = recon.dwellerCounts ?? {};
        const withDwellers = (map: FloorMap): FloorMap => ({
          ...map,
          dwellers: placeDwellers(map, counts[map.floorOrder] ?? 0),
        });
        const findingMeta: Record<string, FindingMeta> = {};
        for (const finding of findings) {
          findingMeta[finding.id] = {
            weaknessType: finding.weaknessType,
            evidenceQuote: finding.evidenceQuote,
            severity: finding.severity,
          };
        }

        void authJson<DungeonPlanPayload>("/api/dungeon/plan", {
          method: "POST",
          body: JSON.stringify({ researchMapId: recon.map.id }),
        })
          .then((dungeon) => {
            if (cancelled) return;
            if (dungeon.floors.length > 0) setPlans(dungeon.floors);
            setDungeonTitle(dungeon.title);
            setDungeonTier(dungeon.tier);
          })
          .catch(() => {
            // Deterministic plan is already playable.
          });

        const active = await authJson<ActiveRunPayload>(
          `/api/run/active?researchMapId=${recon.map.id}`,
        );

        setResearchMapId(recon.map.id);
        setDungeonTitle("Dungeon Naskah");
        setDungeonTier(getDungeonTier(findings));
        setPlans(plans);
        setFindingMeta(findingMeta);
        setDwellerCounts(counts);

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

          const resumedFloor = withDwellers(generateFloorFromPlan(plans[resumeIndex]!, 20261101 + resumeIndex));
          setLoadout(resumeLoadout);
          setPendingCharacter(resumeLoadout.characterSlug);
          setRunId(active.run.id);
          setPoints(active.run.pointsTotal);
          setHearts(active.run.hearts);
          setHp(active.run.hp ?? active.run.hearts * HEART_HP);
          setHpMax(active.run.hpMax ?? heartsForLoadout(resumeLoadout.characterSlug) * HEART_HP);
          setFloorStartHearts(active.run.hearts);
          setFloorIndex(resumeIndex);
          setResolvedKeys(keys);
          setFloorMap({ ...resumedFloor, findingMeta });
          void prefetchFloorQuestions({ ...resumedFloor, findingMeta }, recon.map.id);
          setShowFloorIntro(false);
          setEntryPhase("enter");
          setLoading(false);
          return;
        }

        setFloorIndex(0);
        const firstFloor = withDwellers(generated);
        setFloorMap({ ...firstFloor, findingMeta });
        void prefetchFloorQuestions({ ...firstFloor, findingMeta }, recon.map.id);
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
  }, [params.reconId, router, prefetchFloorQuestions]);

  const startRun = useCallback(
    async (selected: Loadout) => {
      setStarting(true);
      setError(null);
      try {
        const data = await authJson<{ runId: string; pointsTotal: number; hearts: number; hp: number; hpMax: number }>(
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
        setHp(data.hp);
        setHpMax(data.hpMax);
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
        const result = await authJson<{
          pointsTotal: number;
          maxPoints: number;
          rank: string;
          comparison?: {
            previousVersion: number;
            currentVersion: number;
            stillPresent: number;
            changed: number;
            newFindings: number;
          } | null;
        }>("/api/run/finish", { method: "POST", body: JSON.stringify({ runId }) });
        setRunResult(result);
        setPoints(result.pointsTotal);
      } catch {
        setRunResult(null);
      }
      setRunComplete(true);
      return;
    }

    const generated = generateFloorFromPlan(plans[next]!, 20261101 + next);
    const nextFloor = {
      ...generated,
      dwellers: placeDwellers(generated, dwellerCounts[generated.floorOrder] ?? 0),
    };
    setFloorIndex(next);
    setFloorMap({ ...nextFloor, findingMeta });
    void prefetchFloorQuestions({ ...nextFloor, findingMeta }, researchMapId);
    setFloorStartHearts(hearts);
    setShowFloorIntro(true);
    void persistProgress(plans[next]!.floorOrder, resolvedKeys);
  }, [plans, findingMeta, floorIndex, runId, hearts, floorStartHearts, persistProgress, resolvedKeys, researchMapId, prefetchFloorQuestions, dwellerCounts]);

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
      // A retry after a KO needs fresh questions, so drop this floor's bank.
      // Encounters fall back to the single-question route until prefetch runs again.
      setQuestionBank({});
      setHp(hpMax);
      setHearts(Math.max(1, Math.ceil(hpMax / HEART_HP)));
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
  }, [persistProgress, floorIndex, plans, hpMax]);

  useEffect(() => {
    const onLoot = (event: { key: string }) => {
      if (!runId) return;
      void authJson<{ amount: number; kind: "points" | "potion"; pointsTotal: number; potions: number }>(
        "/api/run/loot",
        {
          method: "POST",
          body: JSON.stringify({ runId, lootKey: event.key }),
        },
      )
        .then((data) => {
          setPoints(data.pointsTotal);
          setPotions(data.potions ?? 0);
          setLootNotice(
            data.kind === "potion" ? "Ramuan Kecil masuk tas." : `+${data.amount} koin.`,
          );
          window.setTimeout(() => setLootNotice(null), 2200);
        })
        .catch(() => {
          // Loot still disappears locally; points can sync on the next action.
        });
    };
    bus.on("loot:collected", onLoot);
    return () => bus.off("loot:collected", onLoot);
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    authJson<{ coins: number; potions: number; hp: number; hpMax: number }>(
      `/api/run/shop?runId=${runId}`,
    )
      .then((data) => {
        if (cancelled) return;
        setPoints(data.coins);
        setPotions(data.potions);
        setHp(data.hp);
        setHpMax(data.hpMax);
        setHearts(Math.max(0, Math.ceil(data.hp / HEART_HP)));
      })
      .catch(() => {
        // Shop state is best-effort; HP still comes from the run endpoints.
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    const onTreasure = ({ floor }: { floor: number }) => setShopFloor(floor);
    bus.on("treasure:open", onTreasure);
    return () => bus.off("treasure:open", onTreasure);
  }, []);

  const usePotion = useCallback(async () => {
    if (!runId || potionPending.current || inEncounter) return;
    potionPending.current = true;
    setPotionBusy(true);
    try {
      const data = await authJson<{ hp: number; hpMax: number; potions: number; healed: number }>(
        "/api/run/potion",
        {
          method: "POST",
          body: JSON.stringify({ runId, requestId: crypto.randomUUID() }),
        },
      );
      setHp(data.hp);
      setHpMax(data.hpMax);
      setPotions(data.potions);
      setHearts(Math.max(0, Math.ceil(data.hp / HEART_HP)));
      bus.emit("potion:used", { healed: data.healed });
    } catch {
      // The HUD keeps the old count; the next action re-syncs server state.
    } finally {
      potionPending.current = false;
      setPotionBusy(false);
    }
  }, [runId, inEncounter]);

  useEffect(() => {
    if (!runId || floorMap?.dimension !== "ghost") {
      ghostShownRef.current = false;
      setShowGhostLibrary(false);
      return;
    }
    if (ghostShownRef.current) return;
    ghostShownRef.current = true;
    setShowGhostLibrary(true);
  }, [runId, floorMap?.dimension]);

  useEffect(() => {
    // Give the freshly-created Phaser scene a beat to attach its bus listeners.
    const timer = window.setTimeout(() => {
      bus.emit(showGhostLibrary ? "game:pause" : "game:resume");
    }, showGhostLibrary ? 120 : 0);
    return () => window.clearTimeout(timer);
  }, [showGhostLibrary]);

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
    let openedTimer = 0;
    const onDoorOpened = ({ roomNumber }: { roomNumber: number }) => {
      setDoorOpened(roomNumber);
      window.clearTimeout(openedTimer);
      openedTimer = window.setTimeout(() => setDoorOpened(null), 2400);
    };
    const onRoomProgress = (progress: { roomNumber: number; remaining: number; total: number } | null) =>
      setRoomProgress(progress);
    bus.on("door:locked", onDoorLocked);
    bus.on("door:opened", onDoorOpened);
    bus.on("room:progress", onRoomProgress);
    return () => {
      window.clearTimeout(openedTimer);
      bus.off("door:locked", onDoorLocked);
      bus.off("door:opened", onDoorOpened);
      bus.off("room:progress", onRoomProgress);
    };
  }, []);

  const updateGameSettings = useCallback((next: GameSettings) => {
    setGameSettings(next);
    writeGameSettings(next);
  }, []);

  useEffect(() => {
    setGameSettings(readGameSettings());
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
    void request?.().then(lockLandscape).catch(() => {});
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
        void request?.().then(lockLandscape).catch(() => {});
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
      if ((event.key === "q" || event.key === "Q") && !event.repeat) {
        if (inEncounter || showFloorIntro || paused || shopFloor !== null) return;
        event.preventDefault();
        void usePotion();
        return;
      }
      if (event.key !== "Escape") return;
      if (inEncounter || showFloorIntro) return;
      event.preventDefault();
      setPaused((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loadout, runComplete, inEncounter, showFloorIntro, paused, shopFloor, usePotion]);

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
            <CharacterPortrait slug={pendingCharacter} size={76} className="absolute bottom-4 left-[25%] animate-walk-in" />
            <MonsterPortrait slug="veylith" isBoss size={86} className="absolute bottom-4 right-[22%]" />
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
          {runResult?.comparison ? (
            <div className="mt-3 border-2 border-ridge/60 bg-void/45 p-3 text-left">
              <p className="font-pixel text-[0.52rem] uppercase tracking-[0.08em] text-gold">
                Perbandingan versi {runResult.comparison.previousVersion} →{" "}
                {runResult.comparison.currentVersion}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                <span className="border border-moss/40 bg-moss/10 px-2 py-1.5">
                  <span className="block text-[0.5rem] uppercase tracking-[0.08em] text-ash">
                    Masih ada
                  </span>
                  <span className="mt-0.5 block font-pixel text-sm text-moss">
                    {runResult.comparison.stillPresent}
                  </span>
                </span>
                <span className="border border-gold/40 bg-gold/10 px-2 py-1.5">
                  <span className="block text-[0.5rem] uppercase tracking-[0.08em] text-ash">
                    Berubah
                  </span>
                  <span className="mt-0.5 block font-pixel text-sm text-gold">
                    {runResult.comparison.changed}
                  </span>
                </span>
                <span className="border border-blood/40 bg-blood/10 px-2 py-1.5">
                  <span className="block text-[0.5rem] uppercase tracking-[0.08em] text-ash">
                    Baru
                  </span>
                  <span className="mt-0.5 block font-pixel text-sm text-blood">
                    {runResult.comparison.newFindings}
                  </span>
                </span>
              </div>
            </div>
          ) : null}
          <p className="mt-4 text-sm leading-6 text-ash">
            Semua lantai sudah ditelusuri. Buka laporan untuk melihat peta kelemahan naskah.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link
              href={runId ? `/report/${runId}` : `/findings/${params.reconId}`}
              className="pixel-button border-gold bg-gold text-void hover:bg-bone"
            >
              Lihat laporan run
            </Link>
            <Link
              href={`/findings/${params.reconId}`}
              className="pixel-button border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold"
            >
              Peta kelemahan
            </Link>
            <Link
              href="/dashboard"
              className="pixel-button border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold sm:col-span-2"
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
      className="game-immersive relative overflow-hidden bg-[#0D0F15]"
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
        hp={hp}
        hpMax={hpMax}
        potions={potions}
        potionBusy={potionBusy}
        onUsePotion={() => void usePotion()}
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

      {gameSettings.showMinimap ? (
        <Minimap
          floorMap={floorMap}
          storageKey={`fog:${researchMapId || "map"}:${floorMap.floorOrder}`}
          resolvedKeys={resolvedKeys}
        />
      ) : null}
      <TouchControls
        potions={potions}
        potionBusy={potionBusy}
        scheme={gameSettings.controls}
        onUsePotion={() => void usePotion()}
        onPause={() => setPaused(true)}
        onSettings={() => setShowSettings(true)}
      />
      {showGhostLibrary ? (
        <GhostLibrary
          runId={runId}
          onClose={() => {
            setShowGhostLibrary(false);
            void prefetchFloorQuestions(floorMap, researchMapId, true);
          }}
        />
      ) : null}
      <EncounterOverlay
        hearts={hearts}
        onHeartsChange={(next) => setHearts(next)}
        onHpChange={(nextHp, nextHpMax) => {
          setHp(nextHp);
          setHpMax(nextHpMax);
          setHearts(Math.max(0, Math.ceil(nextHp / HEART_HP)));
        }}
        researchMapId={researchMapId}
        loadout={loadout}
        playerName={playerName ?? getCharacter(loadout.characterSlug)?.name ?? "Kamu"}
        heartsMax={heartsForLoadout(loadout.characterSlug)}
        runId={runId}
        questionBank={questionBank}
        onPointsChange={setPoints}
      />
      {shopFloor !== null ? (
        <ShopModal
          runId={runId}
          floor={shopFloor}
          onClose={() => setShopFloor(null)}
          onVitals={(state) => {
            setPoints(state.coins);
            setPotions(state.potions);
            setHp(state.hp);
            setHpMax(state.hpMax);
            setHearts(Math.max(0, Math.ceil(state.hp / HEART_HP)));
          }}
        />
      ) : null}
      <LandscapeGate />
      <div className="absolute right-2 top-2 z-10 hidden flex-wrap items-center justify-end gap-1 text-right text-[0.62rem] font-bold uppercase tracking-[0.07em] text-ash md:flex">
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
      <p className="absolute bottom-2 left-2 z-10 hidden max-w-[55vw] border-2 border-void bg-void/85 px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.07em] text-ash shadow-[inset_0_0_0_1px_#34424e] md:block">
        WASD / panah · scroll zoom · tabrak monster · M suara · Esc jeda
      </p>

      {roomProgress ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 border-2 border-ember/60 bg-[#0a0f14]/90 px-3 py-1 shadow-[3px_3px_0_#05080b]">
          <p className="font-pixel text-[0.5rem] text-bone">
            RUANG {roomProgress.roomNumber} · SISA {roomProgress.remaining}/{roomProgress.total} MONSTER
          </p>
        </div>
      ) : null}

      {roomProgress === null && loadout && !inEncounter && !showFloorIntro && !runComplete ? (
        <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 border-2 border-gold/70 bg-[#0a0f14]/95 px-3 py-1.5 text-center shadow-[4px_4px_0_#05080b]">
          <p className="font-pixel text-[0.5rem] text-gold">TANGGA TURUN TERBUKA</p>
          <p className="mt-0.5 text-[0.68rem] leading-5 text-bone">
            Ada di ruang boss — ikuti tanda <span className="text-gold">↓</span> atau titik emas di peta.
          </p>
        </div>
      ) : null}

      {doorOpened ? (
        <div className="game-rise absolute bottom-12 left-1/2 z-30 -translate-x-1/2 border-2 border-emerald-400/70 bg-[#0a0f14]/95 px-3 py-2 text-center shadow-[4px_4px_0_#05080b]">
          <p className="font-pixel text-[0.52rem] text-emerald-300">PINTU TERBUKA</p>
          <p className="mt-1 text-[0.72rem] leading-5 text-bone">Jalan ke ruang {doorOpened} sudah terbuka.</p>
        </div>
      ) : null}

      {lootNotice ? (
        <div className="game-rise absolute bottom-12 left-1/2 z-30 -translate-x-1/2 border-2 border-gold/70 bg-[#0a0f14]/95 px-3 py-2 text-center shadow-[4px_4px_0_#05080b]">
          <p className="font-pixel text-[0.52rem] text-gold">JARAHAN</p>
          <p className="mt-1 text-[0.72rem] leading-5 text-bone">{lootNotice}</p>
        </div>
      ) : null}

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
          bossSlug={activePlan.bossSlug}
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
          playerName={playerName ?? getCharacter(loadout.characterSlug)?.name ?? "Kamu"}
          findingsHref={`/findings/${params.reconId}`}
          onResume={() => setPaused(false)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenShop={() => setShopFloor(floorIndex + 1)}
        />
      ) : null}

      {showSettings ? (
        <GameSettingsModal
          settings={gameSettings}
          onChange={updateGameSettings}
          onClose={() => setShowSettings(false)}
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
