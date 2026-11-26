"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { bus } from "@/game/bus";
import type { GameEvents } from "@/game/bus";
import type {
  CombatOutcome,
  EncounterTopic,
  EvaluationResult,
  EncounterStatus,
  MonsterKind,
} from "@/lib/domain/types";
import { COMPREHENSION } from "@/lib/domain/types";
import type { GeneratedQuestion } from "@/lib/encounter/schema";
import { HEART_HP, MAX_ANSWER_LENGTH, MIN_ANSWER_LENGTH } from "@/lib/balance";
import { monsterLevel, monsterStats } from "@/lib/combat/monsterStats";
import { getWeapon, type Loadout } from "@/lib/loadout";
import { getMonsterDisplayName } from "@/lib/monsters";
import { authJson } from "@/lib/api/client";
import { PixelSprite } from "@/components/brand/PixelSprite";
import { CharacterPortrait, MonsterPortrait } from "@/components/brand/Portrait";
import HeartDisplay from "./HeartDisplay";
import HpBar from "./HpBar";
import ScoreBreakdown from "./ScoreBreakdown";
import AdviceModal from "./AdviceModal";

type EncounterData = GameEvents["encounter:start"];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function fallbackTopic(bossSlug: string, provided?: EncounterTopic): EncounterTopic {
  if (provided) return provided;
  if (bossSlug === "nyxara") return "citation_claim_mismatch";
  if (bossSlug === "eldravos") return "conclusion_overclaim";
  return "gap_unsupported";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EncounterRuntimeState {
  encounter: EncounterData;
  weaknessType: EncounterTopic;
  evidenceQuote: string;
  hp: number;
  hpMax: number;
  questionsAsked: number;
  status: EncounterStatus;
  lastEvaluation: EvaluationResult | null;
  showBreakdown: boolean;
  showAdvice: boolean;
  question: string | null;
  questionId: string | null;
  targetCriterionIds: string[];
  questionLoading: boolean;
  questionError: string | null;
  previousQuestions: string[];
  previousAttackTypes: string[];
  attackType: string | null;
  bankRemaining: GeneratedQuestion[];
  lastAnswer: string;
  lastWeapon: string | null;
  lastPointsAwarded: number;
  lastLootAwarded: number;
  lastLootKind: "zonk" | "coins" | "gem";
  lastPointsTotal: number;
  combat: CombatOutcome | null;
  monsterLevel: number;
  monsterHpMax: number;
  maxQuestions: number;
  playerHp: number;
  playerHpMax: number;
  history: Array<{ answer: string; evaluation: EvaluationResult }>;
}

interface EncounterOverlayProps {
  hearts: number;
  onHeartsChange: (hearts: number) => void;
  researchMapId: string;
  loadout: Loadout;
  playerName?: string;
  heartsMax: number;
  runId: string;
  questionBank?: Record<string, GeneratedQuestion[]>;
  onPointsChange: (points: number) => void;
  onHpChange?: (hp: number, hpMax: number) => void;
}

export default function EncounterOverlay({
  hearts,
  onHeartsChange,
  researchMapId,
  loadout,
  playerName,
  heartsMax,
  runId,
  questionBank,
  onPointsChange,
  onHpChange,
}: EncounterOverlayProps) {
  const [state, setState] = useState<EncounterRuntimeState | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [hint, setHint] = useState<{ question: string; text: string } | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const [indexUsedFloors, setIndexUsedFloors] = useState<number[]>([]);
  const [indexInfo, setIndexInfo] = useState<{ floor: number; section: string } | null>(null);
  const [indexLoading, setIndexLoading] = useState(false);
  const [attackPhase, setAttackPhase] = useState<"idle" | "attack" | "waiting" | "hit">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const adviceScores = useMemo(
    () =>
      state?.lastEvaluation?.scores.map((score) => ({
        criterionId: score.criterionId,
        level: score.level,
      })) ?? [],
    [state?.lastEvaluation],
  );

  const syncEncounterState = useCallback(
    async (encounter: EncounterData) => {
      if (!runId) return;
      const params = new URLSearchParams({
        runId,
        encounterKey: encounter.encounterKey,
        floorOrder: String(encounter.floor),
        roomOrder: String(encounter.room),
      });
      try {
        const data = await authJson<{
          encounter: null | {
            hp: number;
            hpMax: number;
            questionsAsked: number;
            status: EncounterStatus;
            question: string | null;
            attackType: string | null;
            targetCriterionIds: string[] | null;
          };
          hearts: number;
          hp: number;
          hpMax: number;
        }>(`/api/encounter/state?${params.toString()}`);
        onHeartsChange(data.hearts);
        setState((prev) =>
          prev
            ? { ...prev, playerHp: data.hp, playerHpMax: data.hpMax }
            : prev,
        );
        if (!data.encounter) return;
        const saved = data.encounter;
        setState((prev) =>
          prev && prev.encounter.encounterId === encounter.encounterId
            ? {
                ...prev,
                hp: saved.hp,
                hpMax: saved.hpMax,
                monsterHpMax: saved.hpMax,
                questionsAsked: saved.questionsAsked,
                status: saved.status,
              }
            : prev,
        );

        // Resume from the same question slot instead of replaying Q1.
        const bank = questionBank?.[encounter.encounterKey] ?? [];
        const next = bank[saved.questionsAsked];
        const resumedQuestion = saved.question ?? next?.question;
        if (saved.questionsAsked > 0 && resumedQuestion) {
          setState((prev) =>
            prev && prev.encounter.encounterId === encounter.encounterId
              ? {
                  ...prev,
                  question: resumedQuestion,
                  questionId: next?.questionId ?? prev.questionId,
                  targetCriterionIds:
                    saved.targetCriterionIds ?? next?.targetCriterionIds ?? prev.targetCriterionIds,
                  attackType: saved.attackType ?? next?.attackType ?? prev.attackType,
                  bankRemaining: next ? bank.slice(saved.questionsAsked + 1) : [],
                  questionLoading: false,
                  questionError: null,
                }
              : prev,
          );
        }
      } catch {
        // Fall back to fresh HP; the answer route still uses server state.
      }
    },
    [runId, onHeartsChange, questionBank],
  );

  const requestQuestion = useCallback(
    async (
      encounter: EncounterData,
      previousQuestions: string[],
      previousAttackTypes: string[],
    ) => {
      setState((prev) =>
        prev && prev.encounter.encounterId === encounter.encounterId
          ? {
              ...prev,
              question: null,
              questionLoading: true,
              questionError: null,
              previousQuestions,
              previousAttackTypes,
            }
          : prev,
      );

      try {
        const payload = {
          researchMapId,
          encounterKey: encounter.encounterKey,
          bossSlug: encounter.bossSlug,
          weaknessType: fallbackTopic(encounter.bossSlug, encounter.weaknessType),
          evidenceQuote: encounter.evidenceQuote ?? "",
          previousQuestions,
          previousAttackTypes,
          isBoss: encounter.isBoss ?? encounter.bossSlug.startsWith("boss"),
          floorOrder: encounter.floor,
          roomOrder: encounter.room,
          ...(encounter.findingId ? { findingId: encounter.findingId } : {}),
        };
        const data = await authJson<{
          question: string;
          questionId: string;
          attackType: string;
          targetCriterionIds: string[];
        }>("/api/encounter/question", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setState((prev) =>
          prev && prev.encounter.encounterId === encounter.encounterId
            ? {
                ...prev,
                question: data.question,
                questionId: data.questionId,
                targetCriterionIds: data.targetCriterionIds,
                attackType: data.attackType,
                questionLoading: false,
                questionError: null,
              }
            : prev,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal membuat pertanyaan.";
        setState((prev) =>
          prev && prev.encounter.encounterId === encounter.encounterId
            ? {
                ...prev,
                question: null,
                questionLoading: false,
                questionError: message,
              }
            : prev,
        );
      }
    },
    [researchMapId],
  );

  // ── Bus listeners ─────────────────────────────────────────────────────────

  useEffect(() => {
    const onStart = (data: EncounterData) => {
      const wt = fallbackTopic(data.bossSlug, data.weaknessType);
      const isBoss = data.isBoss ?? data.bossSlug.startsWith("boss");
      const kind: MonsterKind = wt === COMPREHENSION ? "dweller" : isBoss ? "boss" : "minion";
      const level = monsterLevel({ kind, floorOrder: data.floor, severity: data.severity });
      const stats = monsterStats(kind, level);
      const hpMax = stats.hp;
      const bank = questionBank?.[data.encounterKey] ?? [];
      const first = bank[0] ?? null;

      setState({
        encounter: data,
        weaknessType: wt,
        evidenceQuote: data.evidenceQuote ?? "",
        hp: hpMax,
        hpMax,
        questionsAsked: 0,
        status: "active",
        lastEvaluation: null,
        showBreakdown: false,
        showAdvice: false,
        question: first?.question ?? null,
        questionId: first?.questionId ?? null,
        targetCriterionIds: first?.targetCriterionIds ?? [],
        questionLoading: !first,
        questionError: null,
        previousQuestions: [],
        previousAttackTypes: [],
        attackType: first?.attackType ?? null,
        bankRemaining: first ? bank.slice(1) : [],
        lastAnswer: "",
        lastWeapon: null,
        lastPointsAwarded: 0,
        lastLootAwarded: 0,
        lastLootKind: "zonk",
        lastPointsTotal: 0,
        combat: null,
        monsterLevel: level,
        monsterHpMax: stats.hp,
        maxQuestions: stats.maxQuestions,
        playerHp: hearts * HEART_HP,
        playerHpMax: heartsMax * HEART_HP,
        history: [],
      });
      setAnswer("");
      setAnswerError(null);
      setHint(null);
      setHintError(null);
      setHintLoading(false);
      setAttackPhase("idle");
      void syncEncounterState(data);
      if (!first) void requestQuestion(data, [], []);
      requestAnimationFrame(() => textareaRef.current?.focus());
    };

    bus.on("encounter:start", onStart);
    return () => bus.off("encounter:start", onStart);
  }, [requestQuestion, questionBank, syncEncounterState, hearts, heartsMax]);

  // Short landscape screens make the story column scroll; keep the live part
  // (answer composer, then the result) inside the visible area.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || panel.scrollHeight <= panel.clientHeight) return;
    panel.scrollTo({
      top: state?.showBreakdown ? panel.scrollHeight : 0,
      behavior: "smooth",
    });
  }, [state?.question, state?.showBreakdown]);

  // ── Resolve encounter (close overlay, emit bus event) ────────────────────

  const resolveEncounter = useCallback(
    (status: "won" | "conceded" | "disputed" | "fled") => {
      if (!state) return;
      bus.emit("encounter:end", {
        encounterId: state.encounter.encounterId,
        encounterKey: state.encounter.encounterKey,
        result: status,
      });
      setState(null);
      setAnswer("");
    },
    [state],
  );

  // ── Submit answer ─────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!state || submitting || !state.question || answer.trim().length === 0) return;
    if (answer.trim().length < MIN_ANSWER_LENGTH) {
      setAnswerError("Tulis dulu — minimal 12 karakter. Jawaban pendek tidak memotong Heart.");
      return;
    }
    setSubmitting(true);
    setAnswerError(null);
    setAttackPhase("attack");
    const startedAt = Date.now();
    const waitingTimer = window.setTimeout(() => setAttackPhase("waiting"), 620);

    try {
      const data = await authJson<{
        evaluation: EvaluationResult;
        newHp: number;
        newHearts: number;
        encounterStatus: EncounterStatus;
        pointsAwarded: number;
        lootAwarded: number;
        lootKind: "zonk" | "coins" | "gem";
        pointsTotal: number;
        weaponUsed: string | null;
        combat: CombatOutcome;
        hp: number;
        hpMax: number;
        monsterLevel: number;
        monsterHpMax: number;
      }>("/api/encounter/answer", {
        method: "POST",
        body: JSON.stringify({
          encounterId: state.encounter.encounterId,
          encounterKey: state.encounter.encounterKey,
          researchMapId,
          runId,
          ...(state.encounter.findingId ? { findingId: state.encounter.findingId } : {}),
          bossSlug: state.encounter.bossSlug,
          weaknessType: state.weaknessType,
          answer,
          question: state.question,
          attackType: state.attackType ?? undefined,
          targetCriterionIds: state.targetCriterionIds,
          evidenceQuote: state.evidenceQuote,
          isBoss: state.encounter.isBoss ?? state.encounter.bossSlug.startsWith("boss"),
          floorOrder: state.encounter.floor,
          roomOrder: state.encounter.room,
          characterSlug: loadout.characterSlug,
          weaponSlug: loadout.weaponSlug,
        }),
      });

      window.clearTimeout(waitingTimer);
      const remaining = Math.max(0, 650 - (Date.now() - startedAt));
      if (remaining > 0) await wait(remaining);

      setAttackPhase("hit");
      bus.emit("boss:hit", {
        encounterId: state.encounter.encounterId,
        damage: data.combat.damage,
        quality: data.combat.quality,
        qualityLabel: data.combat.qualityLabel,
        attackStyle: data.combat.attackStyle,
        weaponName: data.combat.weaponName,
        weaponKind: data.combat.weaponKind,
        counterDamage: data.combat.counterDamage,
        shielded: data.combat.shielded,
        monsterHp: data.newHp,
        monsterHpMax: data.monsterHpMax,
        heartLost: data.evaluation.heartLost,
      });
      onHeartsChange(data.newHearts);
      onHpChange?.(data.hp, data.hpMax);
      onPointsChange(data.pointsTotal);

      setState((prev) =>
        prev
          ? {
              ...prev,
              hp: data.newHp,
              questionsAsked: prev.questionsAsked + 1,
              status: data.encounterStatus,
              lastEvaluation: data.evaluation,
              lastAnswer: answer,
              lastWeapon: data.combat.weaponSlug,
              combat: data.combat,
              monsterLevel: data.monsterLevel,
              monsterHpMax: data.monsterHpMax,
              playerHp: data.hp,
              playerHpMax: data.hpMax,
              lastPointsAwarded: data.pointsAwarded,
              lastLootAwarded: data.lootAwarded,
              lastLootKind: data.lootKind,
              lastPointsTotal: data.pointsTotal,
              showBreakdown: false,
              showAdvice: false,
              history: [
                ...prev.history,
                { answer, evaluation: data.evaluation },
              ],
            }
          : null,
      );
      setAnswer("");
      await wait(460);
      setState((prev) => (prev ? { ...prev, showBreakdown: true } : null));
      setAttackPhase("idle");
      setSubmitting(false);
    } catch (err) {
      window.clearTimeout(waitingTimer);
      setAttackPhase("idle");
      setSubmitting(false);
      setAnswerError(err instanceof Error ? err.message : "Gagal menilai jawaban.");
    }
  }, [state, answer, submitting, hearts, onHeartsChange, onHpChange, researchMapId, loadout, runId, onPointsChange]);

  // ── Continue after score breakdown ────────────────────────────────────────

  const handleContinue = useCallback(() => {
    if (!state) return;
    const { status } = state;

    if (status === "won") {
      resolveEncounter("won");
    } else if (status === "conceded") {
      resolveEncounter("conceded");
    } else if (status === "lost") {
      setState((prev) => prev ? { ...prev, showAdvice: true, showBreakdown: false } : null);
    } else {
      const previousQuestions = state.question
        ? [...state.previousQuestions, state.question]
        : state.previousQuestions;
      const previousAttackTypes = state.attackType
        ? [...state.previousAttackTypes, state.attackType]
        : state.previousAttackTypes;

      if (state.bankRemaining.length > 0) {
        const next = state.bankRemaining[0]!;
        const rest = state.bankRemaining.slice(1);
        setState((prev) =>
          prev
            ? {
                ...prev,
                showBreakdown: false,
                lastEvaluation: null,
                question: next.question,
                questionId: next.questionId,
                targetCriterionIds: next.targetCriterionIds,
                attackType: next.attackType,
                bankRemaining: rest,
                previousQuestions,
                previousAttackTypes,
                questionLoading: false,
                questionError: null,
              }
            : null,
        );
        return;
      }

      setState((prev) =>
        prev ? { ...prev, showBreakdown: false, lastEvaluation: null } : null,
      );
      void requestQuestion(state.encounter, previousQuestions, previousAttackTypes);
    }
  }, [state, resolveEncounter, requestQuestion]);

  const handleHint = useCallback(async () => {
    if (!state?.question || hintLoading) return;
    const question = state.question;
    setHintLoading(true);
    setHintError(null);
    try {
      const data = await authJson<{ hint: string }>("/api/encounter/hint", {
        method: "POST",
        body: JSON.stringify({
          researchMapId,
          question,
          weaknessType: state.weaknessType,
          bossSlug: state.encounter.bossSlug,
          evidenceQuote: state.evidenceQuote,
        }),
      });
      setHint({ question, text: data.hint });
    } catch (err) {
      setHintError(err instanceof Error ? err.message : "Gagal membuat petunjuk.");
    } finally {
      setHintLoading(false);
    }
  }, [state, researchMapId, hintLoading]);

  const handleIndex = useCallback(async () => {
    if (!state || indexLoading) return;
    const floor = state.encounter.floor;
    if (indexUsedFloors.includes(floor)) return;
    setIndexLoading(true);
    try {
      const data = await authJson<{ section: string }>("/api/encounter/index", {
        method: "POST",
        body: JSON.stringify({
          researchMapId,
          evidenceQuote: state.evidenceQuote,
        }),
      });
      setIndexInfo({ floor, section: data.section });
      setIndexUsedFloors((prev) => [...prev, floor]);
    } catch {
      // Passive failed; keep it available so the player can retry.
    } finally {
      setIndexLoading(false);
    }
  }, [state, indexLoading, indexUsedFloors, researchMapId]);

  // ── Objection! ────────────────────────────────────────────────────────────

  const handleObjection = useCallback(async () => {
    if (!state) return;
    setAnswerError(null);
    try {
      await authJson("/api/encounter/dispute", {
        method: "POST",
        body: JSON.stringify({
          runId,
          floorOrder: state.encounter.floor,
          roomOrder: state.encounter.room,
          bossSlug: state.encounter.bossSlug,
          weaknessType: state.weaknessType,
          ...(state.encounter.findingId ? { findingId: state.encounter.findingId } : {}),
          isBoss: state.encounter.isBoss ?? state.encounter.bossSlug.startsWith("boss"),
        }),
      });
    } catch (err) {
      // Objection quota lives on the server; keep the fight open if it refuses.
      setAnswerError(err instanceof Error ? err.message : "Objection! ditolak.");
      return;
    }
    resolveEncounter("disputed");
  }, [state, resolveEncounter, runId]);

  // ── Advice modal actions ───────────────────────────────────────────────────

  const handleRetry = useCallback(async () => {
    if (!state) return;
    try {
      await authJson("/api/run/retry", {
        method: "POST",
        body: JSON.stringify({ runId, floorOrder: state.encounter.floor }),
      });
    } catch {
      // Local reset still runs; the next answer reports any server mismatch.
    }
    // Close the encounter overlay first, then signal Phaser to reset the floor
    resolveEncounter("fled");
    onHeartsChange(heartsMax);
    bus.emit("floor:retry", undefined);
    bus.emit("hearts:reset", undefined);
  }, [state, resolveEncounter, onHeartsChange, heartsMax, runId]);

  const handleRevise = useCallback(async () => {
    let manuscriptId: string | undefined;
    try {
      const data = await authJson<{ manuscriptId?: string }>("/api/run/revise", {
        method: "POST",
        body: JSON.stringify({ runId }),
      });
      manuscriptId = data.manuscriptId;
    } catch {
      // Still send the player to upload; the current run can be closed later.
    }
    window.location.assign(
      manuscriptId ? `/upload?reviseFrom=${encodeURIComponent(manuscriptId)}` : "/upload",
    );
  }, [runId]);

  // ── Keyboard ──────────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation(); // prevent WASD from moving the player while typing
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!state) return null;

  const {
    encounter,
    weaknessType,
    evidenceQuote,
    hp,
    hpMax,
    status,
    lastEvaluation,
    showBreakdown,
    showAdvice,
  } = state;

  const bossName      = getMonsterDisplayName(encounter.bossSlug) || "Examiner";
  const isBoss        = encounter.isBoss ?? encounter.bossSlug.startsWith("boss");
  const level         = state.monsterLevel;

  // Show Kitab Nasihat
  if (showAdvice) {
    return (
      <AdviceModal
        researchMapId={researchMapId}
        runId={runId}
        floorOrder={state.encounter.floor}
        roomOrder={state.encounter.room}
        findingId={state.encounter.findingId || undefined}
        bossSlug={state.encounter.bossSlug}
        weaknessType={weaknessType}
        evidenceQuote={evidenceQuote}
        playerAnswer={state.lastAnswer}
        missing={state.lastEvaluation?.missing ?? ""}
        scores={adviceScores}
        history={state.history.map((entry) => ({
          answer: entry.answer,
          scores: entry.evaluation.scores.map((score) => ({
            criterionId: score.criterionId,
            level: score.level,
          })),
          missing: entry.evaluation.missing,
        }))}
        onRetry={handleRetry}
        onRevise={handleRevise}
      />
    );
  }

  return (
    <div className="comic-overlay game-fade fixed inset-0 z-50 flex flex-col justify-end">
      <div
        role="dialog"
        aria-label="Pertarungan"
        className={`comic-dock game-screen-in max-h-[100dvh] w-full overflow-y-auto border-t-4 bg-[#0a0f14] shadow-[0_-8px_0_rgba(0,0,0,0.35)] ${
          isBoss ? "border-gold" : "border-ridge"
        }`}
      >
        <div className="comic-strip-bar flex items-center justify-between gap-3 px-3 py-2">
          <span className="font-pixel text-[0.54rem] text-gold">
            PERTARUNGAN · LANTAI {encounter.floor} ·{" "}
            {weaknessType === COMPREHENSION ? "LORONG" : `RUANG ${encounter.room + 1}`}
          </span>
          <span className="text-[0.58rem] font-bold uppercase tracking-[0.08em] text-ash">
            {statusLabel(status)} · Tingkat {level}
          </span>
        </div>

        <div className="comic-grid grid gap-0 sm:grid-cols-[0.9fr_1.1fr]">
          <aside className="comic-panel comic-panel-monster relative border-b-2 border-void p-3 sm:border-b-0 sm:border-r-2">
            <div className="comic-halftone" aria-hidden="true" />

            {evidenceQuote ? (
              <p className="comic-caption relative z-10">
                <span>Kutipan yang diserang</span>
                “{evidenceQuote}”
              </p>
            ) : null}

            <div className={`comic-arena relative z-10 h-40 overflow-hidden border-2 border-void ${attackPhase === "hit" ? "is-hit" : ""}`}>
              <div className="comic-sky" aria-hidden="true" />
              <span className="absolute left-2 top-2 z-20 font-pixel text-[0.46rem] text-moss">KAMU</span>
              <span className="absolute right-2 top-2 z-20 font-pixel text-[0.46rem] text-blood">
                {weaknessType === COMPREHENSION ? "PENGHUNI" : isBoss ? "BOSS" : "ANTEK"} · Lv {level}
              </span>

              {attackPhase === "attack" || attackPhase === "hit" ? (
                <div className="comic-speed-lines" aria-hidden="true" />
              ) : null}

              <div className={`comic-player absolute bottom-3 left-[11%] ${attackPhase === "attack" ? "is-attacking" : ""}`}>
                <CharacterPortrait
                  slug={loadout.characterSlug}
                  size={isBoss ? 78 : 68}
                  className="drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]"
                />
              </div>

              <div className={`comic-monster absolute bottom-3 right-[9%] ${attackPhase === "hit" ? (lastEvaluation?.damage === 0 ? "is-miss" : "is-hit") : ""} ${status === "won" ? "is-dead" : ""}`}>
                <MonsterPortrait
                  slug={encounter.bossSlug}
                  isBoss={isBoss}
                  size={isBoss ? 116 : 92}
                  className="drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]"
                />
                <span className={`comic-nameplate ${isBoss ? "is-boss" : ""}`}>{bossName}</span>
              </div>

              {attackPhase === "attack" ? (
                <>
                  <span className="comic-slash" aria-hidden="true" />
                  <span className="comic-slash is-second" aria-hidden="true" />
                </>
              ) : null}

              {attackPhase === "hit" && lastEvaluation ? (
                <>
                  <span
                    key={`word-${state.questionsAsked}`}
                    className={`comic-impact-word ${lastEvaluation.damage > 0 ? "" : "is-miss"}`}
                    aria-hidden="true"
                  >
                    {lastEvaluation.damage <= 0
                      ? "MELESET!"
                      : state.combat?.attackStyle === "bow"
                        ? "TEMBAK!"
                        : state.combat?.attackStyle === "axe"
                          ? "TEBAS GANDA!"
                          : state.combat?.attackStyle === "shield"
                            ? "HANTAM!"
                            : "TEBAS!"}
                  </span>
                  <span
                    key={`damage-${lastEvaluation.damage}-${state.questionsAsked}`}
                    className={`comic-damage ${lastEvaluation.damage > 0 ? "is-hit" : ""}`}
                    aria-hidden="true"
                  >
                    {lastEvaluation.damage > 0 ? `−${lastEvaluation.damage}` : "0"}
                  </span>
                </>
              ) : null}
            </div>

            <div className="relative z-10 mt-2">
              <HpBar hp={hp} hpMax={hpMax} />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1" aria-label={`Serangan ${state.questionsAsked}`}>
                  {Array.from({ length: state.maxQuestions }).map((_, index) => (
                    <span
                      key={index}
                      className="turn-pip"
                      data-used={index < state.questionsAsked}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <span className="text-[0.54rem] font-bold uppercase tracking-[0.08em] text-ash">
                  Serangan {state.questionsAsked}/{state.maxQuestions}
                </span>
              </div>
              <div className="mt-2">
                <HeartDisplay hearts={hearts} heartsMax={heartsMax} hp={state.playerHp} hpMax={state.playerHpMax} />
              </div>
            </div>

          </aside>

          <section ref={panelRef} className="comic-panel comic-panel-player relative p-3 sm:p-4">
                        <div className="comic-bubble-wrap relative z-10 mb-3">
              <div className="comic-bubble is-monster-speech" aria-live="polite">
                <div className="mb-2 flex items-start justify-between gap-2 border-b-2 border-[#2c2114]/25 pb-1.5">
                  <span className="font-pixel text-[0.46rem] uppercase tracking-[0.1em] text-[#6b4b1e]">
                    {showBreakdown && lastEvaluation ? "Monster menjawab" : `${bossName.split(" — ")[0]} menyerang`}
                  </span>
                  {!showBreakdown ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {loadout.characterSlug === "mira" &&
                      !indexUsedFloors.includes(state.encounter.floor) ? (
                        <button
                          type="button"
                          onClick={() => void handleIndex()}
                          disabled={indexLoading}
                          className="comic-mini-button text-[#2f6f68]"
                          aria-label="Tampilkan label bagian bukti"
                        >
                          {indexLoading ? "Membaca..." : "Indeks"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleHint()}
                        disabled={hintLoading}
                        className="comic-mini-button"
                        aria-label="Jelaskan maksud pertanyaan"
                      >
                        <BulbIcon />
                        {hintLoading ? "Menerjemahkan..." : "Petunjuk"}
                      </button>
                    </div>
                  ) : null}
                </div>

                {showBreakdown && lastEvaluation ? (
                  <p className="comic-line text-[0.92rem] leading-6 text-[#2b2318]">
                    {status === "won"
                      ? "Kuh... bukti itu terlalu tajam. Klaimku runtuh."
                      : lastEvaluation.damage === 0
                        ? "Kosong. Tidak ada bukti yang menusukku."
                        : state.combat && state.combat.counterDamage > 0
                          ? "Jawabanmu goyah. Rasakan balasanku!"
                          : state.combat?.shielded
                            ? "Tameng itu menahan seranganku..."
                            : `Ugh! ${lastEvaluation.damage} damage... jawaban itu kena.`}
                  </p>
                ) : state.questionLoading ? (
                  <p className="comic-line flex items-center gap-2 text-[0.88rem] text-[#4a3a25]">
                    <span className="comic-typing" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    Penguji menyusun serangan...
                  </p>
                ) : state.questionError ? (
                  <div>
                    <p className="comic-line text-[0.82rem] leading-5 text-[#7a2d1e]">{state.questionError}</p>
                    <button
                      onClick={() => void requestQuestion(state.encounter, state.previousQuestions, state.previousAttackTypes)}
                      className="comic-mini-button mt-2"
                    >
                      Coba lagi
                    </button>
                  </div>
                ) : (
                  <p className="comic-line text-[0.95rem] leading-6 text-[#2b2318]">
                    {state.question ?? "..."}
                  </p>
                )}

                {hintError ? (
                  <p className="mt-2 border-l-2 border-[#8a3a2a]/60 pl-2 text-[0.72rem] leading-5 text-[#7a2d1e]">
                    {hintError}
                  </p>
                ) : null}

                {hint && hint.question === state.question ? (
                  <div className="mt-2 border-l-2 border-[#b8792c]/60 bg-[#e3d0a6]/55 py-1.5 pl-2">
                    <p className="font-pixel text-[0.44rem] uppercase tracking-[0.1em] text-[#6b4b1e]">
                      Maksud pertanyaan
                    </p>
                    <p className="mt-1 text-[0.76rem] leading-5 text-[#4a3a25]">{hint.text}</p>
                  </div>
                ) : null}

                {indexInfo && indexInfo.floor === state.encounter.floor ? (
                  <div className="mt-2 border-l-2 border-[#2f6f68]/60 bg-[#d7ece8]/55 py-1.5 pl-2">
                    <p className="font-pixel text-[0.44rem] uppercase tracking-[0.1em] text-[#2f6f68]">
                      Indeks Mira · lokasi bukti
                    </p>
                    <p className="mt-1 text-[0.76rem] leading-5 text-[#4a3a25]">
                      {indexInfo.section && indexInfo.section !== "tanpa bagian"
                        ? `Bukti ini ada di bagian: ${indexInfo.section}`
                        : "Naskahmu belum punya judul bagian di sekitar bukti ini."}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="comic-player-head relative z-10 mb-3 flex items-center gap-2 border-b-2 border-void pb-2">
              <CharacterPortrait slug={loadout.characterSlug} size={38} />
              <div>
                <p className="font-pixel text-[0.44rem] uppercase tracking-[0.12em] text-moss">Kamu</p>
                <p className="text-sm font-bold leading-5 text-bone">
                  {playerName ?? loadout.characterSlug}
                </p>
              </div>
            </div>

            {state.lastAnswer && (showBreakdown || submitting) ? (
              <div className="comic-bubble is-player mb-3">
                <p className="font-pixel text-[0.44rem] uppercase tracking-[0.1em] text-[#33474f]">
                  Jawabanmu
                </p>
                <p className="comic-line mt-1 text-[0.84rem] leading-5 text-[#223035]">
                  “{state.lastAnswer}”
                </p>
              </div>
            ) : null}

            {showBreakdown && lastEvaluation ? (
              <div className="game-rise mt-4 border-2 border-void bg-void/55 p-3 shadow-[inset_0_0_0_1px_#34424e]">
                <div className="mb-2 flex items-center justify-between gap-2 border-b border-ridge/40 pb-2">
                  <span className="font-pixel text-[0.5rem] uppercase tracking-[0.1em] text-gold">
                    {status === "won"
                      ? "Monster tumbang"
                      : status === "lost"
                        ? "HP habis"
                        : status === "conceded"
                          ? "Monster bertahan"
                          : "Hasil serangan"}
                  </span>
                  <span className={`font-pixel text-[0.6rem] ${lastEvaluation.damage > 0 ? "text-blood" : "text-ash"}`}>
                    {lastEvaluation.damage > 0 ? `−${lastEvaluation.damage} HP` : "0 DAMAGE"}
                  </span>
                </div>

                <div className="mb-2 grid grid-cols-3 gap-1.5">
                  <span className="border border-ridge/50 bg-void/50 px-2 py-1.5 text-center">
                    <span className="block text-[0.48rem] font-bold uppercase tracking-[0.08em] text-ash">Damage</span>
                    <span className={`mt-0.5 block font-pixel text-sm ${lastEvaluation.damage > 0 ? "text-blood" : "text-ash"}`}>
                      {lastEvaluation.damage}
                    </span>
                  </span>
                  <span className="border border-ridge/50 bg-void/50 px-2 py-1.5 text-center">
                    <span className="block text-[0.48rem] font-bold uppercase tracking-[0.08em] text-ash">Skor</span>
                    <span className="mt-0.5 block font-pixel text-sm text-gold">
                      {lastEvaluation.scoreMax > 0
                        ? `${Math.round((lastEvaluation.scoreTotal / lastEvaluation.scoreMax) * 100)}%`
                        : "0%"}
                    </span>
                  </span>
                  <span className="border border-ridge/50 bg-void/50 px-2 py-1.5 text-center">
                    <span className="block text-[0.48rem] font-bold uppercase tracking-[0.08em] text-ash">Heart</span>
                    <span className={`mt-0.5 block font-pixel text-sm ${lastEvaluation.heartLost ? "text-blood" : "text-moss"}`}>
                      {lastEvaluation.heartLost ? "−1" : "aman"}
                    </span>
                  </span>
                </div>

                {state.combat ? (
                  <div className="mb-2 border border-ridge/50 bg-void/45 px-2 py-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[0.6rem] font-bold uppercase tracking-[0.07em]">
                      <span className="text-ash">Mutu jawaban</span>
                      <span className="text-gold">
                        Q{state.combat.quality} · {state.combat.qualityLabel}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[0.6rem] font-bold uppercase tracking-[0.07em]">
                      <span className="text-ash">Senjata</span>
                      <span className={state.combat.weaponKind === "signature" ? "text-ember" : "text-bone"}>
                        {state.combat.weaponName} · {state.combat.weaponKind === "signature" ? "andalan" : "dasar"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[0.6rem] font-bold uppercase tracking-[0.07em]">
                      <span className="text-ash">Balasan monster</span>
                      <span className={state.combat.counterDamage > 0 ? "text-blood" : "text-moss"}>
                        {state.combat.shielded ? "ditahan tameng" : state.combat.counterDamage > 0 ? `-${state.combat.counterDamage} HP` : "tidak ada"}
                      </span>
                    </div>
                  </div>
                ) : null}

                {lastEvaluation.heartLost ? (
                  <p className="mb-2 border border-blood/30 bg-blood/10 px-2 py-1 text-[0.66rem] leading-5 text-blood">
                    Heart berkurang karena jawaban tidak menjawab pertanyaan yang diajukan.
                  </p>
                ) : null}
                {state.lastWeapon ? (
                  <p className="mb-2 flex items-center justify-between gap-2 border-b border-ridge/40 pb-2 text-[0.58rem] font-bold uppercase tracking-[0.08em]">
                    <span className="text-ash">Senjata otomatis</span>
                    <span className="text-gold">
                      {getWeapon(state.lastWeapon)?.name ?? state.lastWeapon}
                    </span>
                  </p>
                ) : null}
                <ScoreBreakdown
                  evaluation={lastEvaluation}
                  weaknessType={weaknessType}
                  targetCriterionIds={lastEvaluation.targetCriterionIds ?? state.targetCriterionIds}
                />

                {state.lastPointsAwarded > 0 ? (
                  <div className="reward-burst relative mt-3 overflow-hidden border-2 border-gold/70 bg-gold/10 p-3 text-center">
                    <span className="reward-spark reward-spark-a" aria-hidden="true" />
                    <span className="reward-spark reward-spark-b" aria-hidden="true" />
                    <span className="reward-spark reward-spark-c" aria-hidden="true" />
                    <p className="font-pixel text-[0.5rem] uppercase tracking-[0.14em] text-gold">
                      Harta karun
                    </p>
                    {state.lastLootKind === "zonk" ? (
                      <>
                        <div className="mt-1 flex items-center justify-center gap-2">
                          <PixelSprite kind="chest" size={34} className="grayscale opacity-40" />
                          <span className="zonk-shake font-pixel text-xl font-bold text-ash">
                            ZONK
                          </span>
                        </div>
                        <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash/70">
                          Peti kosong. Nggak ada bonus poin.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="mt-1 flex items-center justify-center gap-2">
                          <PixelSprite kind="chest" size={34} />
                          <span className="reward-amount font-pixel text-2xl font-bold text-gold">
                            +{state.lastLootAwarded} POIN
                          </span>
                        </div>
                        <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash">
                          Bonus {state.lastLootKind === "gem" ? "permata" : "koin"}
                        </p>
                      </>
                    )}
                    <p className="mt-2 border-t border-gold/20 pt-2 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-ash">
                      Hadiah tempur +{state.lastPointsAwarded} poin · Total {state.lastPointsTotal}
                    </p>
                  </div>
                ) : null}

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-ash">
                    {lastEvaluation.heartLost ? "Heart berkurang" : "Heart aman"}
                  </span>
                  <button
                    onClick={handleContinue}
                    className="pixel-button pixel-button-sm border-gold bg-gold text-void hover:bg-bone"
                  >
                    {status === "won"
                      ? "Selesai"
                      : status === "conceded"
                        ? "Lanjut"
                        : status === "lost"
                          ? "Lihat nasihat"
                          : "Pertanyaan berikutnya"}
                  </button>
                </div>
              </div>
            ) : null}

            {!showBreakdown && status === "active" && (submitting || attackPhase !== "idle") ? (
              <div className="mt-4 border-2 border-gold/40 bg-gold/5 p-4 text-center">
                <p className="font-pixel text-[0.55rem] text-gold">
                  {attackPhase === "attack"
                    ? "KAMU MENYERANG"
                    : attackPhase === "hit"
                      ? "HANTAMAN MASUK"
                      : "AI MENIMBANG BUKTI"}
                </p>
                <p className="mt-2 text-sm leading-6 text-ash">
                  {attackPhase === "waiting"
                    ? "Penguji menghitung dukungan bukti. Jangan tutup layar."
                    : "Tunggu hasil serangan..."}
                </p>
                <div className="bar-track mt-3 overflow-hidden">
                  <div className="entry-load-fill" />
                </div>
              </div>
            ) : null}

            {!showBreakdown && status !== "active" && attackPhase === "idle" && !submitting ? (
              <div className="mt-4 border-2 border-gold/50 bg-gold/5 p-3 text-center">
                <p className="font-pixel text-[0.5rem] uppercase tracking-[0.1em] text-gold">
                  {status === "won"
                    ? "MONSTER TUMBANG"
                    : status === "lost"
                      ? "HP HABIS"
                      : "PERTARUNGAN SELESAI"}
                </p>
                <p className="mt-1 text-sm leading-6 text-ash">
                  Pertarungan ini sudah selesai. Lanjutkan ekspedisi.
                </p>
                <button
                  type="button"
                  onClick={handleContinue}
                  className="pixel-button pixel-button-sm mt-3 border-gold bg-gold text-void hover:bg-bone"
                >
                  Lanjut
                </button>
              </div>
            ) : null}

            {!showBreakdown && status === "active" && attackPhase === "idle" && !submitting ? (
              <div className="sticky bottom-0 z-20 -mx-3 mt-4 border-t-2 border-void bg-[#0d1218] px-3 pb-3 pt-2 sm:-mx-4 sm:px-4 sm:pb-4">
                <div className="comic-chips mt-4 grid grid-cols-3 gap-1.5" aria-hidden="true">
                  <span className="border border-ridge/60 bg-void/50 px-2 py-1 text-center text-[0.56rem] font-bold uppercase tracking-[0.06em] text-ash">
                    Klaim
                  </span>
                  <span className="border border-ridge/60 bg-void/50 px-2 py-1 text-center text-[0.56rem] font-bold uppercase tracking-[0.06em] text-ash">
                    Bukti
                  </span>
                  <span className="border border-ridge/60 bg-void/50 px-2 py-1 text-center text-[0.56rem] font-bold uppercase tracking-[0.06em] text-ash">
                    Batas
                  </span>
                </div>

                <textarea
                  ref={textareaRef}
                  value={answer}
                  maxLength={MAX_ANSWER_LENGTH}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={4}
                  placeholder="Serang dengan bukti dari naskah..."
                  className="comic-answer pixel-input mt-2 resize-none"
                  aria-label="Jawabanmu"
                />

                <div className="comic-counter mt-2 flex items-center justify-between gap-2 text-[0.6rem] font-bold uppercase tracking-[0.07em] text-ash/70">
                  <span>Bukti lebih kuat daripada gaya bahasa</span>
                  <span>{answer.length}/{MAX_ANSWER_LENGTH}</span>
                </div>

                {answerError ? (
                  <p className="mt-3 text-sm leading-6 text-ember">{answerError}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  {weaknessType !== COMPREHENSION ? (
                    <button
                      onClick={handleObjection}
                      className="pixel-button pixel-button-sm border-ember/60 bg-ember/10 text-ember hover:bg-ember hover:text-void"
                      title="Tandai temuan ini salah. Tidak memotong Heart."
                    >
                      Objection!
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={
                      answer.trim().length === 0 ||
                      submitting ||
                      !state.question ||
                      state.questionLoading ||
                      Boolean(state.questionError)
                    }
                    className="pixel-button pixel-button-sm border-gold bg-gold text-void hover:bg-bone"
                  >
                    {submitting ? "Menilai..." : "Serang ⚔"}
                  </button>
                </div>
                <p className="comic-helper mt-2 text-[0.6rem] leading-4 text-ash/70">
                  Minimal {MIN_ANSWER_LENGTH} karakter. Jawaban terlalu pendek tidak memotong Heart.
                </p>
              </div>
            ) : null}

            {!showBreakdown && status === "won" ? (
              <p className="mt-4 border-2 border-moss/50 bg-moss/10 p-3 text-sm font-bold text-moss">
                Monster tumbang. Ruang terbuka.
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function BulbIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5a4 4 0 0 0-2.5 7.1c.4.35.65.85.65 1.4v.5h3.7v-.5c0-.55.25-1.05.65-1.4A4 4 0 0 0 8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M6.4 12.2h3.2M6.9 14h2.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function statusTone(status: EncounterStatus): string {
  if (status === "won") return "text-moss";
  if (status === "lost") return "text-blood";
  if (status === "conceded" || status === "disputed") return "text-gold";
  return "text-ash";
}

function statusLabel(status: EncounterStatus): string {
  if (status === "won") return "Menang";
  if (status === "lost") return "Kalah";
  if (status === "conceded") return "Selesai";
  if (status === "disputed") return "Sengketa";
  return "Aktif";
}
