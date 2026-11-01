"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { bus } from "@/game/bus";
import type { GameEvents } from "@/game/bus";
import type {
  WeaknessType,
  EvaluationResult,
  EncounterStatus,
} from "@/lib/domain/types";
import { BOSS_HP, MINION_HP, MAX_QUESTIONS_BOSS, MAX_QUESTIONS_MINION } from "@/lib/balance";
import { getWeapon, type Loadout } from "@/lib/loadout";
import { getMonsterDisplayName } from "@/lib/monsters";
import { authJson } from "@/lib/api/client";
import { PixelSprite, spriteForWeakness } from "@/components/brand/PixelSprite";
import HeartDisplay from "./HeartDisplay";
import HpBar from "./HpBar";
import ScoreBreakdown from "./ScoreBreakdown";
import AdviceModal from "./AdviceModal";

type EncounterData = GameEvents["encounter:start"];

function fallbackWeakness(bossSlug: string, provided?: WeaknessType): WeaknessType {
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
  weaknessType: WeaknessType;
  evidenceQuote: string;
  hp: number;
  hpMax: number;
  questionsAsked: number;
  status: EncounterStatus;
  lastEvaluation: EvaluationResult | null;
  showBreakdown: boolean;
  showAdvice: boolean;
  question: string | null;
  questionLoading: boolean;
  questionError: string | null;
  previousQuestions: string[];
  previousAttackTypes: string[];
  attackType: string | null;
  lastAnswer: string;
  lastWeapon: string | null;
  lastPointsAwarded: number;
  lastPointsTotal: number;
}

interface EncounterOverlayProps {
  hearts: number;
  onHeartsChange: (hearts: number) => void;
  researchMapId: string;
  loadout: Loadout;
  heartsMax: number;
  runId: string;
  onPointsChange: (points: number) => void;
}

export default function EncounterOverlay({
  hearts,
  onHeartsChange,
  researchMapId,
  loadout,
  heartsMax,
  runId,
  onPointsChange,
}: EncounterOverlayProps) {
  const [state, setState] = useState<EncounterRuntimeState | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adviceScores = useMemo(
    () =>
      state?.lastEvaluation?.scores.map((score) => ({
        criterionId: score.criterionId,
        level: score.level,
      })) ?? [],
    [state?.lastEvaluation],
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
          bossSlug: encounter.bossSlug,
          weaknessType: fallbackWeakness(encounter.bossSlug, encounter.weaknessType),
          evidenceQuote: encounter.evidenceQuote ?? "",
          previousQuestions,
          previousAttackTypes,
          isBoss: encounter.isBoss ?? encounter.bossSlug.startsWith("boss"),
          ...(encounter.findingId ? { findingId: encounter.findingId } : {}),
        };
        const data = await authJson<{ question: string; attackType: string }>(
          "/api/encounter/question",
          { method: "POST", body: JSON.stringify(payload) },
        );
        setState((prev) =>
          prev && prev.encounter.encounterId === encounter.encounterId
            ? {
                ...prev,
                question: data.question,
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
      const wt = fallbackWeakness(data.bossSlug, data.weaknessType);
      const isBoss = data.isBoss ?? data.bossSlug.startsWith("boss");
      const hpMax = isBoss ? BOSS_HP : MINION_HP;

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
        question: null,
        questionLoading: true,
        questionError: null,
        previousQuestions: [],
        previousAttackTypes: [],
        attackType: null,
        lastAnswer: "",
        lastWeapon: null,
        lastPointsAwarded: 0,
        lastPointsTotal: 0,
      });
      setAnswer("");
      setAnswerError(null);
      void requestQuestion(data, [], []);
      requestAnimationFrame(() => textareaRef.current?.focus());
    };

    bus.on("encounter:start", onStart);
    return () => bus.off("encounter:start", onStart);
  }, [requestQuestion]);

  // ── Resolve encounter (close overlay, emit bus event) ────────────────────

  const resolveEncounter = useCallback(
    (status: "won" | "conceded" | "disputed" | "fled") => {
      if (!state) return;
      bus.emit("encounter:end", {
        encounterId: state.encounter.encounterId,
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
    setSubmitting(true);
    setAnswerError(null);

    try {
      const data = await authJson<{
        evaluation: EvaluationResult;
        newHp: number;
        newHearts: number;
        encounterStatus: EncounterStatus;
        pointsAwarded: number;
        pointsTotal: number;
        weaponUsed: string | null;
      }>("/api/encounter/answer", {
        method: "POST",
        body: JSON.stringify({
          encounterId: state.encounter.encounterId,
          researchMapId,
          ...(state.encounter.findingId ? { findingId: state.encounter.findingId } : {}),
          bossSlug: state.encounter.bossSlug,
          weaknessType: state.weaknessType,
          answer,
          evidenceQuote: state.evidenceQuote,
          isBoss: state.encounter.isBoss ?? state.encounter.bossSlug.startsWith("boss"),
          hp: state.hp,
          hearts,
          questionsAsked: state.questionsAsked,
          characterSlug: loadout.characterSlug,
          weaponSlug: loadout.weaponSlug,
          ...(runId ? { runId } : {}),
        }),
      });

      // Emit boss:hit for the shake + damage number animation
      bus.emit("boss:hit", {
        encounterId: state.encounter.encounterId,
        damage: data.evaluation.damage,
      });

      onHeartsChange(data.newHearts);
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
              lastWeapon: data.weaponUsed,
              lastPointsAwarded: data.pointsAwarded,
              lastPointsTotal: data.pointsTotal,
              showBreakdown: true,
              showAdvice: data.encounterStatus === "lost",
            }
          : null,
      );
      setAnswer("");
    } catch (err) {
      setAnswerError(err instanceof Error ? err.message : "Gagal menilai jawaban.");
    } finally {
      setSubmitting(false);
    }
  }, [state, answer, submitting, hearts, onHeartsChange, researchMapId, loadout, runId, onPointsChange]);

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
      setState((prev) =>
        prev ? { ...prev, showBreakdown: false, lastEvaluation: null } : null,
      );
      void requestQuestion(state.encounter, previousQuestions, previousAttackTypes);
    }
  }, [state, resolveEncounter, requestQuestion]);

  // ── Objection! ────────────────────────────────────────────────────────────

  const handleObjection = useCallback(() => {
    if (!state) return;
    resolveEncounter("disputed");
  }, [state, resolveEncounter]);

  // ── Advice modal actions ───────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    if (!state) return;
    // Close the encounter overlay first, then signal Phaser to reset the floor
    resolveEncounter("fled");
    onHeartsChange(heartsMax);
    bus.emit("floor:retry", undefined);
    bus.emit("hearts:reset", undefined);
  }, [state, resolveEncounter, onHeartsChange, heartsMax]);

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

  // Show Kitab Nasihat
  if (showAdvice) {
    return (
      <AdviceModal
        researchMapId={researchMapId}
        findingId={state.encounter.findingId || undefined}
        bossSlug={state.encounter.bossSlug}
        weaknessType={weaknessType}
        evidenceQuote={evidenceQuote}
        playerAnswer={state.lastAnswer}
        missing={state.lastEvaluation?.missing ?? ""}
        scores={adviceScores}
        onRetry={handleRetry}
        onRevise={() => {}} // disabled in M2
      />
    );
  }

  return (
    <div className="game-fade fixed inset-0 z-50 flex items-center justify-center bg-[#05080b]/88 px-3 py-4 backdrop-blur-[3px]">
      <div
        className={`game-screen-in max-h-[94vh] w-full max-w-3xl overflow-y-auto border-2 bg-[#0a0f14] shadow-[8px_8px_0_#05080b] ${
          isBoss ? "border-gold" : "border-ridge"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-void bg-tomb px-3 py-2">
          <span className="font-pixel text-[0.54rem] text-gold">
            PERTARUNGAN · LANTAI {encounter.floor} · RUANG {encounter.room + 1}
          </span>
          <span className="text-[0.58rem] font-bold uppercase tracking-[0.08em] text-ash">
            {statusLabel(status)}
          </span>
        </div>

        <div className="grid gap-0 lg:grid-cols-[0.82fr_1.18fr]">
          <aside className="tile-floor relative flex flex-row items-center gap-4 border-b-2 border-void p-4 lg:flex-col lg:items-stretch lg:border-b-0 lg:border-r-2">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(233,184,93,0.14),transparent_65%)]" aria-hidden="true" />

            <div className="relative mx-auto grid h-28 w-24 shrink-0 place-items-end justify-items-center border-2 border-void bg-[#0a0f14]/70 pb-2 lg:h-36 lg:w-32">
              <PixelSprite kind={spriteForWeakness(weaknessType)} size={isBoss ? 92 : 74} />
              {showBreakdown && lastEvaluation ? (
                <span
                  key={`${lastEvaluation.damage}-${state.questionsAsked}`}
                  className={`damage-pop absolute -right-2 top-2 border-2 border-void px-2 py-1 font-pixel text-sm font-bold shadow-[3px_3px_0_#05080b] ${
                    lastEvaluation.damage > 0
                      ? "bg-blood text-void"
                      : "bg-ridge text-bone"
                  }`}
                  aria-hidden="true"
                >
                  {lastEvaluation.damage > 0 ? `-${lastEvaluation.damage}` : "MISS"}
                </span>
              ) : null}
            </div>

            <div className="relative min-w-0 flex-1">
              <p className="font-pixel text-[0.48rem] uppercase tracking-[0.1em] text-ash">
                {isBoss ? "BOSS" : "ANTEK"}
              </p>
              <h2 className={`mt-1 text-xl font-bold leading-tight sm:text-2xl ${isBoss ? "text-blood" : "text-gold"}`}>
                {bossName}
              </h2>
              <div className="mt-3">
                <HpBar hp={hp} hpMax={hpMax} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1" aria-label={`Serangan ${state.questionsAsked}`}>
                  {Array.from({ length: isBoss ? MAX_QUESTIONS_BOSS : MAX_QUESTIONS_MINION }).map((_, index) => (
                    <span
                      key={index}
                      className="turn-pip"
                      data-used={index < state.questionsAsked}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <span className="text-[0.58rem] font-bold uppercase tracking-[0.08em] text-ash">
                  Serangan {state.questionsAsked}/{isBoss ? MAX_QUESTIONS_BOSS : MAX_QUESTIONS_MINION}
                </span>
              </div>
              <div className="mt-3">
                <HeartDisplay hearts={hearts} heartsMax={heartsMax} />
              </div>
            </div>
          </aside>

          <section className="p-4 sm:p-5">
            {evidenceQuote ? (
              <blockquote className="border-l-2 border-gold/70 bg-void/55 py-2 pl-3 text-[0.8rem] leading-6 text-ash">
                <span className="mb-1 block font-pixel text-[0.46rem] uppercase tracking-[0.1em] text-gold">
                  Kutipan yang diserang
                </span>
                “{evidenceQuote}”
              </blockquote>
            ) : null}

            {showBreakdown && lastEvaluation ? (
              <div className="game-rise mt-4 border-2 border-void bg-void/55 p-3 shadow-[inset_0_0_0_1px_#34424e]">
                {state.lastWeapon ? (
                  <p className="mb-2 flex items-center justify-between gap-2 border-b border-ridge/40 pb-2 text-[0.58rem] font-bold uppercase tracking-[0.08em]">
                    <span className="text-ash">Senjata otomatis</span>
                    <span className="text-gold">
                      {getWeapon(state.lastWeapon)?.name ?? state.lastWeapon}
                    </span>
                  </p>
                ) : null}
                <ScoreBreakdown evaluation={lastEvaluation} weaknessType={weaknessType} />

                {state.lastPointsAwarded > 0 ? (
                  <div className="reward-burst relative mt-3 overflow-hidden border-2 border-gold/70 bg-gold/10 p-3 text-center">
                    <span className="reward-spark reward-spark-a" aria-hidden="true" />
                    <span className="reward-spark reward-spark-b" aria-hidden="true" />
                    <span className="reward-spark reward-spark-c" aria-hidden="true" />
                    <p className="font-pixel text-[0.5rem] uppercase tracking-[0.14em] text-gold">
                      Harta karun
                    </p>
                    <div className="mt-1 flex items-center justify-center gap-2">
                      <PixelSprite kind="chest" size={34} />
                      <span className="reward-amount font-pixel text-2xl font-bold text-gold">
                        +{state.lastPointsAwarded} POIN
                      </span>
                    </div>
                    <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash">
                      Total {state.lastPointsTotal} poin
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
                          : "Serangan berikutnya"}
                  </button>
                </div>
              </div>
            ) : null}

            {!showBreakdown && status === "active" ? (
              <div className="mt-4">
                {state.questionLoading ? (
                  <div className="border-2 border-void bg-void/50 p-4">
                    <p className="flex items-center gap-2 font-pixel text-[0.54rem] text-gold">
                      <span className="h-2 w-2 animate-flicker bg-ember" aria-hidden="true" />
                      PENGUJI MENYUSUN SERANGAN
                    </p>
                    <p className="mt-2 text-sm leading-6 text-ash">Dengarkan baik-baik...</p>
                  </div>
                ) : null}

                {state.questionError ? (
                  <div className="border-2 border-ember/50 bg-ember/10 p-3 text-sm text-ember">
                    <p>{state.questionError}</p>
                    <button
                      onClick={() => void requestQuestion(state.encounter, state.previousQuestions, state.previousAttackTypes)}
                      className="pixel-button pixel-button-sm mt-3 border-ember text-ember hover:bg-ember hover:text-void"
                    >
                      Coba lagi
                    </button>
                  </div>
                ) : null}

                {state.question ? (
                  <div className="game-rise border-2 border-ridge/70 bg-[#111920] p-3">
                    <p className="font-pixel text-[0.48rem] uppercase tracking-[0.1em] text-gold">
                      {bossName.split(" — ")[0]} menyerang
                    </p>
                    <p className="mt-2 text-[0.95rem] leading-7 text-bone">{state.question}</p>
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-3 gap-1.5" aria-hidden="true">
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
                  maxLength={1200}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={4}
                  placeholder="Serang dengan bukti dari naskah..."
                  className="pixel-input mt-2 resize-none"
                  aria-label="Jawabanmu"
                />

                <div className="mt-2 flex items-center justify-between gap-2 text-[0.6rem] font-bold uppercase tracking-[0.07em] text-ash/70">
                  <span>Bukti lebih kuat daripada gaya bahasa</span>
                  <span>{answer.length}/1200</span>
                </div>

                {answerError ? (
                  <p className="mt-3 text-sm leading-6 text-ember">{answerError}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={handleObjection}
                    className="pixel-button pixel-button-sm border-ember/60 bg-ember/10 text-ember hover:bg-ember hover:text-void"
                    title="Tandai temuan ini salah. Tidak memotong Heart."
                  >
                    Objection!
                  </button>
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
                <p className="mt-2 text-[0.6rem] leading-4 text-ash/70">
                  Minimal tulis satu kalimat. Jawaban kosong tidak memotong Heart.
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
