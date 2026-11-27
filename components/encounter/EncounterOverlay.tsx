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
import type { Loadout } from "@/lib/loadout";
import { getMonsterDisplayName } from "@/lib/monsters";
import { authJson } from "@/lib/api/client";
import GameMenu, { type MenuEntry } from "@/components/ui/GameMenu";
import { CharacterSprite, MonsterSprite } from "@/components/ui/SheetSprite";
import ScoreBreakdown from "./ScoreBreakdown";
import AdviceModal from "./AdviceModal";
import { BattleInfo, TypedText, battleLines, shortMonsterName } from "./BattleScene";

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
  /** Equipped armor; the battle shows its shield under HP. */
  armor?: ArmorState | null;
  onArmorChange?: (armor: ArmorState | null) => void;
}

export interface ArmorState {
  slug: string;
  name: string;
  shield: number;
  shieldMax: number;
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
  armor = null,
  onArmorChange,
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
  /** What the dialog box shows while the player picks a command. */
  const [view, setView] = useState<"menu" | "answer" | "hint" | "quote" | "objection">("menu");
  const [lineIndex, setLineIndex] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
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
    };

    bus.on("encounter:start", onStart);
    return () => bus.off("encounter:start", onStart);
  }, [requestQuestion, questionBank, syncEncounterState, hearts, heartsMax]);

  // A new question returns to the command menu; a result starts at line one.
  useEffect(() => {
    setView("menu");
  }, [state?.question]);

  useEffect(() => {
    if (!state?.showBreakdown) return;
    setLineIndex(0);
    setShowDetail(false);
  }, [state?.showBreakdown, state?.questionsAsked]);

  useEffect(() => {
    if (view === "answer") requestAnimationFrame(() => textareaRef.current?.focus());
  }, [view]);

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
      setAnswerError("Tulis dulu — minimal 12 karakter. Jawaban pendek tidak memotong HP.");
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
        armor: ArmorState | null;
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
      onArmorChange?.(data.armor ?? null);
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
  }, [state, answer, submitting, hearts, onHeartsChange, onHpChange, onArmorChange, researchMapId, loadout, runId, onPointsChange]);

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

  const playerLabel = playerName ?? loadout.characterSlug;
  const monsterName = shortMonsterName(bossName);
  const busy = submitting || attackPhase !== "idle";
  const lines =
    showBreakdown && lastEvaluation
      ? battleLines({
          playerName: playerLabel,
          monsterName,
          status,
          evaluation: lastEvaluation,
          combat: state.combat,
          pointsAwarded: state.lastPointsAwarded,
          lootAwarded: state.lastLootAwarded,
          lootKind: state.lastLootKind,
        })
      : [];
  const lastLine = lineIndex >= lines.length - 1;
  const continueLabel =
    status === "won" ? "Selesai" : status === "lost" ? "Lihat nasihat" : status === "conceded" ? "Lanjut" : "Lanjut";
  const questionReady = Boolean(state.question) && !state.questionLoading && !state.questionError;
  const canAct = status === "active" && !busy && !showBreakdown && questionReady;
  const comprehension = weaknessType === COMPREHENSION;
  const indexAvailable = loadout.characterSlug === "mira" && !indexUsedFloors.includes(state.encounter.floor);

  const commands: MenuEntry[] = [
    { key: "attack", label: "Serang", onSelect: () => setView("answer") },
    {
      key: "hint",
      label: "Petunjuk",
      onSelect: () => {
        setView("hint");
        if (!(hint && hint.question === state.question)) void handleHint();
      },
    },
    { key: "quote", label: "Kutipan", onSelect: () => setView("quote") },
    {
      key: "object",
      label: "Keberatan",
      disabled: comprehension,
      onSelect: () => setView("objection"),
    },
  ];

  const advance = () => {
    if (!lastLine) setLineIndex((index) => index + 1);
  };

  let dialog: React.ReactNode;
  let menu: React.ReactNode = null;

  if (showBreakdown && lastEvaluation) {
    if (showDetail) {
      dialog = (
        <div className="max-h-[38vh] overflow-y-auto pr-1 font-body text-[0.95rem] leading-6">
          <ScoreBreakdown
            evaluation={lastEvaluation}
            weaknessType={weaknessType}
            targetCriterionIds={lastEvaluation.targetCriterionIds ?? state.targetCriterionIds}
          />
        </div>
      );
      menu = (
        <GameMenu
          key="detail"
          label="Tutup nilai"
          items={[{ key: "close", label: "Tutup", sfx: "uiCancel", onSelect: () => setShowDetail(false) }]}
        />
      );
    } else {
      dialog = (
        <button
          type="button"
          className="battle-line g-1 w-full text-left"
          onClick={advance}
          data-sfx={lastLine ? "none" : "uiMove"}
          aria-label={lastLine ? undefined : "Lanjut"}
        >
          <TypedText key={`${state.questionsAsked}-${lineIndex}`} text={lines[lineIndex] ?? ""} />
          {!lastLine ? <span className="ui-next ml-2 align-middle" aria-hidden="true" /> : null}
        </button>
      );
      menu = lastLine ? (
        <GameMenu
          key={`after-${state.questionsAsked}`}
          label="Setelah serangan"
          items={[
            { key: "next", label: continueLabel, onSelect: handleContinue },
            { key: "detail", label: "Lihat nilai", sfx: "uiOpen", onSelect: () => setShowDetail(true) },
          ]}
        />
      ) : null;
    }
  } else if (busy) {
    dialog = (
      <p className="g-1" aria-live="polite">
        <TypedText
          text={
            attackPhase === "waiting"
              ? `${monsterName} menimbang buktimu...`
              : `${playerLabel} menyerang!`
          }
        />
      </p>
    );
  } else if (status !== "active") {
    dialog = <p className="g-1">Pertarungan selesai.</p>;
    menu = (
      <GameMenu key="ended" label="Lanjut" items={[{ key: "next", label: "Lanjut", onSelect: handleContinue }]} />
    );
  } else if (view === "answer") {
    dialog = (
      <form
        className="flex h-full flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <p className="g-1 line-clamp-2 text-[var(--ui-rust)]">{state.question}</p>
        <textarea
          ref={textareaRef}
          value={answer}
          maxLength={MAX_ANSWER_LENGTH}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(event) => {
            handleKeyDown(event);
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void handleSubmit();
            }
            if (event.key === "Escape") setView("menu");
          }}
          rows={3}
          placeholder="Jawab dengan bukti dari naskahmu..."
          className="pixel-input min-h-[5.5rem] flex-1 resize-none font-body"
          aria-label="Jawabanmu"
        />
        {answerError ? (
          <p role="alert" className="g-1 text-[#a3341f]">
            {answerError}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <span className="g-1 text-[var(--ui-rust)]">
            {answer.length}/{MAX_ANSWER_LENGTH}
          </span>
          <span className="flex gap-2">
            <button type="button" data-sfx="uiCancel" className="ui-btn is-quiet" onClick={() => setView("menu")}>
              Batal
            </button>
            <button type="submit" data-sfx="none" className="ui-btn" disabled={answer.trim().length === 0}>
              Serang
            </button>
          </span>
        </div>
      </form>
    );
  } else if (view === "hint") {
    dialog = (
      <p className="g-1">
        {hintLoading ? (
          "Mencari maksud pertanyaan..."
        ) : hintError ? (
          <span className="text-[#a3341f]">{hintError}</span>
        ) : hint && hint.question === state.question ? (
          <TypedText text={hint.text} />
        ) : (
          "..."
        )}
      </p>
    );
    menu = (
      <GameMenu key="hint" label="Petunjuk" items={[{ key: "back", label: "Kembali", sfx: "uiCancel", onSelect: () => setView("menu") }]} />
    );
  } else if (view === "quote") {
    dialog = (
      <div className="g-1 max-h-[32vh] overflow-y-auto">
        <p className="text-[var(--ui-rust)]">Kutipan yang diserang:</p>
        <p className="font-body text-[0.98rem] leading-6">&ldquo;{evidenceQuote || "Tidak ada kutipan."}&rdquo;</p>
        {indexInfo && indexInfo.floor === state.encounter.floor ? (
          <p className="mt-1">
            {indexInfo.section && indexInfo.section !== "tanpa bagian"
              ? `Ada di bagian: ${indexInfo.section}`
              : "Naskahmu belum punya judul bagian di sekitar kutipan ini."}
          </p>
        ) : null}
      </div>
    );
    menu = (
      <GameMenu
        key="quote"
        label="Kutipan"
        items={[
          ...(indexAvailable
            ? [{ key: "index", label: indexLoading ? "Mencari..." : "Cari bagian", disabled: indexLoading, onSelect: () => void handleIndex() }]
            : []),
          { key: "back", label: "Kembali", sfx: "uiCancel" as const, onSelect: () => setView("menu") },
        ]}
      />
    );
  } else if (view === "objection") {
    dialog = (
      <p className="g-1">
        Tandai temuan ini salah? Monster pergi tanpa koin. HP aman.
        {answerError ? <span className="mt-1 block text-[#a3341f]">{answerError}</span> : null}
      </p>
    );
    menu = (
      <GameMenu
        key="objection"
        label="Keberatan"
        items={[
          { key: "no", label: "Tidak", sfx: "uiCancel", onSelect: () => setView("menu") },
          { key: "yes", label: "Ya, keberatan", onSelect: () => void handleObjection() },
        ]}
      />
    );
  } else {
    dialog = state.questionLoading ? (
      <p className="g-1">
        <TypedText text={`${monsterName} menyusun pertanyaan...`} />
      </p>
    ) : state.questionError ? (
      <div className="g-1">
        <p className="text-[#a3341f]">{state.questionError}</p>
        <button
          type="button"
          onClick={() => void requestQuestion(state.encounter, state.previousQuestions, state.previousAttackTypes)}
          className="ui-btn is-quiet mt-2"
        >
          Coba lagi
        </button>
      </div>
    ) : (
      <p className="g-1">
        <span className="text-[var(--ui-rust)]">{monsterName}: </span>
        <TypedText text={state.question ?? "..."} />
      </p>
    );
    menu = canAct ? <GameMenu key={`cmd-${state.question}`} label="Perintah" columns={2} items={commands} /> : null;
  }

  const foeState =
    status === "won" ? "is-dead" : attackPhase === "hit" ? (lastEvaluation?.damage ? "is-hit" : "is-miss") : "";

  return (
    <div className="battle font-game fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Pertarungan melawan ${monsterName}`}>
      <div className={`battle-arena ${isBoss ? "is-boss" : ""} ${attackPhase === "hit" && state.combat?.counterDamage ? "is-shaking" : ""}`}>
        <BattleInfo
          className="battle-foe-info"
          name={monsterName}
          level={level}
          hp={hp}
          hpMax={state.monsterHpMax || hpMax}
          pips={{ used: state.questionsAsked, max: state.maxQuestions }}
        />
        <div className="battle-platform is-foe" aria-hidden="true" />
        <div className={`battle-foe ${foeState}`}>
          <MonsterSprite slug={encounter.bossSlug} height={isBoss ? 168 : 112} label={monsterName} />
          {attackPhase === "hit" && lastEvaluation ? (
            <span key={`dmg-${state.questionsAsked}`} className={`battle-damage g-2 ${lastEvaluation.damage > 0 ? "" : "is-miss"}`} aria-hidden="true">
              {lastEvaluation.damage > 0 ? `-${lastEvaluation.damage}` : "Meleset"}
            </span>
          ) : null}
        </div>

        <div className="battle-platform is-hero" aria-hidden="true" />
        <div className={`battle-hero ${attackPhase === "attack" || attackPhase === "hit" ? "is-attacking" : ""}`}>
          <CharacterSprite slug={loadout.characterSlug} facing="up" scale={7} walking={false} label={playerLabel} />
        </div>
        <BattleInfo
          className="battle-hero-info"
          name={playerLabel}
          hp={state.playerHp}
          hpMax={state.playerHpMax}
          showNumbers
          shield={armor ? { value: armor.shield, max: armor.shieldMax } : null}
        />
      </div>

      <div className="battle-console">
        <section ref={panelRef} className="ui-box battle-dialog" aria-live="polite">
          {dialog}
        </section>
        {menu ? <nav className="ui-box battle-menu">{menu}</nav> : null}
      </div>
    </div>
  );
}
