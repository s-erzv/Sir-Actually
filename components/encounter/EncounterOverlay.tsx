"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { bus } from "@/game/bus";
import type { GameEvents } from "@/game/bus";
import type {
  WeaknessType,
  EvaluationResult,
  EncounterStatus,
} from "@/lib/domain/types";
import { BOSS_HP, MINION_HP, HEARTS_START } from "@/lib/balance";
import { getMonsterDisplayName } from "@/lib/monsters";
import { PixelSprite, spriteForWeakness } from "@/components/brand/PixelSprite";
import HeartDisplay from "./HeartDisplay";
import HpBar from "./HpBar";
import ScoreBreakdown from "./ScoreBreakdown";
import AdviceModal from "./AdviceModal";

// ---------------------------------------------------------------------------
// Dummy data for M2 (same as M1, but now backed by real judge pipeline)
// ---------------------------------------------------------------------------

type EncounterData = GameEvents["encounter:start"];

const BOSS_NAMES: Record<string, string> = {
  // Floor bosses (Canon roster)
  "boss-floor-1": "Veylith — The Void Stalker",
  "boss-floor-2": "Draeven — The Dreadfang",
  "boss-floor-3": "Kryvax — The Twisted Brood",
  "boss-floor-4": "Morvane — The Gravebound",
  "boss-floor-5": "Nyxara — The Forgotten Keeper",
  "boss-floor-6": "Eldravos — The Ancient Sovereign",
  veylith: "Veylith — The Void Stalker",
  draeven: "Draeven — The Dreadfang",
  kryvax: "Kryvax — The Twisted Brood",
  morvane: "Morvane — The Gravebound",
  nyxara: "Nyxara — The Forgotten Keeper",
  eldravos: "Eldravos — The Ancient Sovereign",
  // Legacy aliases
  gap_hunter: "Veylith — The Void Stalker",
  aligner: "Draeven — The Dreadfang",
  methodologist: "Kryvax — The Twisted Brood",
  auditor: "Morvane — The Gravebound",
  ghost: "Nyxara — The Forgotten Keeper",
  sir_actually: "Eldravos — The Ancient Sovereign",
  // Minions
  "minion-varkul": "Varkul (Brutish beast)",
  "minion-nethrix": "Nethrix (Shadow crawler)",
  "minion-zorveth": "Zorveth (Armored creature)",
  "minion-thalgrim": "Thalgrim (Stone guardian)",
  "minion-xyrath": "Xyrath (Winged predator)",
  "minion-othrak": "Othrak (Undead warrior)",
  "minion-velmora": "Velmora (Cursed spirit)",
  "minion-grivak": "Grivak (Small dungeon beast)",
  minion: "Dungeon Minion",
};

// Map findingId → weaknessType (M2 dummy; replaced by DB lookup in M4)
const FINDING_WEAKNESS: Record<string, WeaknessType> = {
  "f1-gap":    "gap_unsupported",
  "f1-cite":   "claim_without_citation",
  "f1-obj":    "problem_objective_gap",
  "f2-sample": "sample_unreported",
  "f2-overc":  "conclusion_overclaim",
};

const DUMMY_QUESTIONS: Record<WeaknessType, string> = {
  gap_unsupported:
    "Gap penelitianmu diklaim ada, tapi referensi yang mendukungnya belum terlihat. Studi mana yang menunjukkan gap ini nyata dan belum dijawab?",
  gap_answered_by_own_refs:
    "Salah satu referensi yang kamu kutip sepertinya sudah menjawab gap yang kamu klaim. Bagaimana kamu menjelaskan perbedaannya?",
  claim_without_citation:
    "Kamu membuat klaim faktual tanpa sitasi. Dari mana klaim ini berasal?",
  problem_objective_gap:
    "Masalah yang kamu rumuskan tidak terhubung langsung ke tujuan penelitian. Bagaimana kamu menjelaskan hubungannya?",
  objective_rq_mismatch:
    "RQ-mu tidak selaras dengan tujuan yang dinyatakan. Bagaimana kamu menghubungkan keduanya?",
  rq_method_mismatch:
    "Metode yang kamu pilih sepertinya tidak sesuai untuk menjawab RQ-mu. Jelaskan alasanmu.",
  sample_unreported:
    "Ukuran sampelmu tidak dilaporkan. Berapa jumlah responden, dan apa alasan jumlah itu cukup untuk analisis yang kamu lakukan?",
  generalization_beyond_sample:
    "Kesimpulanmu tampak digeneralisasikan ke populasi yang lebih luas dari sampelmu. Bagaimana kamu membenarkan itu?",
  limitation_missing:
    "Penelitianmu tidak memiliki bagian keterbatasan yang memadai. Apa saja keterbatasan yang seharusnya kamu akui?",
  conclusion_overclaim:
    "Kesimpulanmu tampak melampaui apa yang datamu tunjukkan. Apa bukti yang mendukung klaim sekuat itu?",
  objective_without_finding:
    "Salah satu tujuanmu tidak memiliki temuan yang menjawabnya. Bagaimana kamu menjelaskannya?",
  abstract_result_mismatch:
    "Hasil di abstrakmu berbeda dari yang ada di bab hasil. Mana yang akurat?",
  citation_not_found:
    "Referensi ini tidak ditemukan di database akademik. Apakah detailnya sudah benar?",
  citation_claim_mismatch:
    "Referensi ini tidak mendukung klaim yang dilampirkan padanya. Bagaimana kamu membenarkan sitasi ini?",
};

const DUMMY_QUOTES: Record<WeaknessType, string> = {
  gap_unsupported:        "The research gap is claimed but no supporting literature is cited.",
  gap_answered_by_own_refs: "The gap is addressed in references already cited.",
  claim_without_citation: "Studies show significant improvement (p < 0.05) without citing a source.",
  problem_objective_gap:  "The stated problem does not match the declared research objectives.",
  objective_rq_mismatch:  "Research questions do not align with stated objectives.",
  rq_method_mismatch:     "The methodology does not address the research questions.",
  sample_unreported:      "Sample size is not reported in the methodology section.",
  generalization_beyond_sample: "The conclusion generalises findings beyond the sample population.",
  limitation_missing:     "No limitations section is present in the manuscript.",
  conclusion_overclaim:   "The conclusion generalises findings beyond the sample population.",
  objective_without_finding: "Objective stated without a corresponding finding.",
  abstract_result_mismatch: "Abstract states results not found in the results chapter.",
  citation_not_found:     "Reference cannot be verified in academic databases.",
  citation_claim_mismatch: "The cited reference does not support the claim it is attached to.",
};

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
}

interface EncounterOverlayProps {
  hearts: number;
  onHeartsChange: (hearts: number) => void;
  sourceText?: string;
  knownCitations?: string[];
}

export default function EncounterOverlay({
  hearts,
  onHeartsChange,
  sourceText = "",
  knownCitations = [],
}: EncounterOverlayProps) {
  const [state, setState] = useState<EncounterRuntimeState | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Bus listeners ─────────────────────────────────────────────────────────

  useEffect(() => {
    const onStart = (data: EncounterData) => {
      const wt: WeaknessType =
        data.weaknessType ?? FINDING_WEAKNESS[data.findingId] ?? "gap_unsupported";
      const isBoss = data.bossSlug.startsWith("boss");
      const hpMax = isBoss ? BOSS_HP : MINION_HP;

      setState({
        encounter: data,
        weaknessType: wt,
        evidenceQuote: data.evidenceQuote || DUMMY_QUOTES[wt] || "",
        hp: hpMax,
        hpMax,
        questionsAsked: 0,
        status: "active",
        lastEvaluation: null,
        showBreakdown: false,
        showAdvice: false,
      });
      setAnswer("");
      requestAnimationFrame(() => textareaRef.current?.focus());
    };

    bus.on("encounter:start", onStart);
    return () => bus.off("encounter:start", onStart);
  }, []);

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
    if (!state || submitting || answer.trim().length === 0) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/encounter/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounterId:    state.encounter.encounterId,
          findingId:      state.encounter.findingId,
          bossSlug:       state.encounter.bossSlug,
          weaknessType:   state.weaknessType,
          answer,
          evidenceQuote:  state.evidenceQuote,
          isBoss:         state.encounter.bossSlug.startsWith("boss"),
          hp:             state.hp,
          hearts,
          questionsAsked: state.questionsAsked,
          sourceText,
          knownCitations,
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = (await res.json()) as {
        evaluation: EvaluationResult;
        newHp: number;
        newHearts: number;
        encounterStatus: EncounterStatus;
      };

      // Emit boss:hit for the shake + damage number animation
      bus.emit("boss:hit", {
        encounterId: state.encounter.encounterId,
        damage: data.evaluation.damage,
      });

      onHeartsChange(data.newHearts);

      setState((prev) =>
        prev
          ? {
              ...prev,
              hp: data.newHp,
              questionsAsked: prev.questionsAsked + 1,
              status: data.encounterStatus,
              lastEvaluation: data.evaluation,
              showBreakdown: true,
              showAdvice: data.encounterStatus === "lost",
            }
          : null,
      );
      setAnswer("");
    } catch (err) {
      console.error("answer submit failed:", err);
    } finally {
      setSubmitting(false);
    }
  }, [state, answer, submitting, hearts, onHeartsChange, sourceText, knownCitations]);

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
      // Still active — hide breakdown, let player answer next question
      setState((prev) =>
        prev ? { ...prev, showBreakdown: false, lastEvaluation: null } : null,
      );
    }
  }, [state, resolveEncounter]);

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
    onHeartsChange(HEARTS_START);
    bus.emit("floor:retry", undefined);
    bus.emit("hearts:reset", undefined);
  }, [state, resolveEncounter, onHeartsChange]);

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

  const question      = DUMMY_QUESTIONS[weaknessType] ?? "Defend your research.";
  const bossName      = getMonsterDisplayName(encounter.bossSlug) || BOSS_NAMES[encounter.bossSlug] || "Examiner";
  const isBoss        = encounter.bossSlug.startsWith("boss");

  // Show Kitab Nasihat
  if (showAdvice) {
    return (
      <AdviceModal
        weaknessType={weaknessType}
        evidenceQuote={evidenceQuote}
        onRetry={handleRetry}
        onRevise={() => {}} // disabled in M2
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 px-4 backdrop-blur-sm">
      <div className={`${isBoss ? "pixel-panel-gold" : "pixel-panel"} max-h-[90vh] w-full max-w-lg overflow-y-auto p-4 sm:p-6`}>
        <div className="flex items-start gap-3 border-b-2 border-void pb-4">
          <div className="tile-floor grid h-24 w-24 shrink-0 place-items-end justify-items-center border-2 border-void pb-2">
            <PixelSprite kind={spriteForWeakness(weaknessType)} size={78} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-pixel text-[0.55rem] leading-4 text-gold">
              Lantai {encounter.floor} · Ruang {encounter.room + 1}
            </p>
            <h2 className={`mt-1 text-2xl font-bold leading-tight ${isBoss ? "text-blood" : "text-gold"}`}>
              {bossName}
            </h2>
            <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.07em] text-ash">
              {isBoss ? "Boss" : "Minion"} · {statusLabel(status)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <HpBar hp={hp} hpMax={hpMax} />
          <div className="flex items-center justify-between gap-3">
            <HeartDisplay hearts={hearts} />
            {status === "won" && <span className="text-[0.66rem] font-bold uppercase tracking-[0.08em] text-moss">Ditaklukkan</span>}
            {status === "conceded" && <span className="text-[0.66rem] font-bold uppercase tracking-[0.08em] text-gold">Ruang berakhir</span>}
          </div>
        </div>

        {showBreakdown && lastEvaluation && (
          <div className="mt-4 border-2 border-void bg-void/55 p-3 shadow-[inset_0_0_0_1px_#34424e]">
            <ScoreBreakdown evaluation={lastEvaluation} weaknessType={weaknessType} />
            <div className="mt-3 flex justify-end">
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
        )}

        {!showBreakdown && status === "active" && (
          <>
            {evidenceQuote && (
              <blockquote className="mt-4 border-l-2 border-gold/60 bg-void/45 py-2 pl-3 text-sm leading-6 text-ash">
                {evidenceQuote}
              </blockquote>
            )}

            <p className="mt-4 text-[0.95rem] leading-7 text-bone">{question}</p>

            <textarea
              ref={textareaRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              placeholder="Tulis jawabanmu..."
              className="pixel-input mt-4 resize-none"
            />

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                onClick={handleObjection}
                className="pixel-button pixel-button-sm border-ember/60 bg-ember/10 text-ember hover:bg-ember hover:text-void"
              >
                Objection!
              </button>
              <button
                onClick={handleSubmit}
                disabled={answer.trim().length === 0 || submitting}
                className="pixel-button pixel-button-sm border-gold bg-gold text-void hover:bg-bone"
              >
                {submitting ? "Menilai..." : "Kirim jawaban"}
              </button>
            </div>
          </>
        )}
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
