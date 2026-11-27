"use client";

import { useEffect, useState } from "react";
import type { CombatOutcome, EncounterStatus, EvaluationResult } from "@/lib/domain/types";

/** "Veylith — The Void Stalker" -> "Veylith"; "Varkul (Antek)" -> "Varkul". */
export function shortMonsterName(displayName: string): string {
  return displayName.split(" — ")[0]!.split(" (")[0]!.trim() || "Penguji";
}

export interface BattleResultInput {
  playerName: string;
  monsterName: string;
  status: EncounterStatus;
  evaluation: EvaluationResult;
  combat: CombatOutcome | null;
  pointsAwarded: number;
  lootAwarded: number;
  lootKind: "zonk" | "coins" | "gem";
}

/**
 * The turn's outcome as short lines, one per box, the way a handheld RPG
 * narrates a hit. The detailed rubric stays one press away, not on screen.
 */
export function battleLines(input: BattleResultInput): string[] {
  const { playerName, monsterName, status, evaluation, combat } = input;
  const lines: string[] = [];
  lines.push(
    combat
      ? `${playerName} menyerang${combat.usedEvidence ? " dengan bukti naskah" : ""}! Jawaban ${combat.qualityLabel.toLowerCase()}.`
      : `${playerName} menyerang!`,
  );
  lines.push(
    evaluation.damage > 0 ? `${monsterName} kena ${evaluation.damage} damage!` : "Serangan meleset!",
  );
  if (combat && combat.counterDamage + combat.absorbed > 0) {
    let line = `${monsterName} membalas!`;
    if (combat.absorbed > 0) line += ` Armor menahan ${combat.absorbed}.`;
    if (combat.counterDamage > 0) line += ` ${playerName} kehilangan ${combat.counterDamage} HP.`;
    lines.push(line);
  }
  if (combat?.armorBroken) lines.push("Armormu hancur!");
  if (status !== "won" && evaluation.missing.trim()) lines.push(`Yang kurang: ${evaluation.missing.trim()}`);
  if (status === "won") lines.push(`${monsterName} tumbang!`);
  if (status === "lost") lines.push(`HP ${playerName} habis...`);
  if (status === "conceded") lines.push(`${monsterName} masih bertahan. Pertarungan selesai.`);
  if (input.pointsAwarded > 0) {
    lines.push(
      input.lootKind === "zonk"
        ? `Dapat ${input.pointsAwarded} koin. Petinya kosong.`
        : `Dapat ${input.pointsAwarded + input.lootAwarded} koin!`,
    );
  }
  return lines;
}

function hpLevel(ratio: number): "high" | "mid" | "low" {
  if (ratio > 0.5) return "high";
  if (ratio > 0.2) return "mid";
  return "low";
}

/** Name, level and HP box, like the ones above each side of a handheld battle. */
export function BattleInfo({
  name,
  level,
  hp,
  hpMax,
  showNumbers,
  pips,
  shield,
  className = "",
}: {
  name: string;
  level?: number;
  hp: number;
  hpMax: number;
  showNumbers?: boolean;
  /** Attacks used / allowed against this monster. */
  pips?: { used: number; max: number };
  /** Equipped armor's shield; hidden when null. */
  shield?: { value: number; max: number } | null;
  className?: string;
}) {
  const ratio = hpMax > 0 ? Math.max(0, Math.min(1, hp / hpMax)) : 0;
  return (
    <div className={`ui-chip font-game w-[min(19rem,46vw)] ${className}`}>
      <div className="g-1 flex items-baseline justify-between gap-2">
        <span className="truncate">{name}</span>
        {level !== undefined ? <span className="shrink-0">Lv{level}</span> : null}
      </div>
      <div
        className="ui-hp mt-0.5"
        role="meter"
        aria-label={`HP ${name}`}
        aria-valuemin={0}
        aria-valuemax={hpMax}
        aria-valuenow={Math.max(0, Math.round(hp))}
      >
        <span className="ui-hp-tag">HP</span>
        <span className="ui-hp-track">
          <span className="ui-hp-fill block" data-level={hpLevel(ratio)} style={{ width: `${ratio * 100}%` }} />
        </span>
      </div>
      {shield && shield.max > 0 ? <ShieldBar value={shield.value} max={shield.max} /> : null}
      {showNumbers || pips ? (
        <div className="g-1 mt-0.5 flex items-center justify-between gap-2">
          {pips ? (
            <span className="flex items-center gap-1" aria-label={`Serangan ${pips.used} dari ${pips.max}`}>
              {Array.from({ length: pips.max }).map((_, index) => (
                <span
                  key={index}
                  className={`inline-block h-2.5 w-2.5 border-2 border-[var(--ui-ink)] ${index < pips.used ? "bg-[var(--ui-ink)]" : ""}`}
                />
              ))}
            </span>
          ) : (
            <span />
          )}
          {showNumbers ? (
            <span>
              {Math.max(0, Math.round(hp))}/{hpMax}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Text that prints itself in, a couple of letters a frame, like a cartridge
 * dialog box. Screen readers get the whole line at once; reduced motion skips
 * the effect.
 */
export function TypedText({ text, className = "" }: { text: string; className?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const timer = window.setInterval(() => {
      setShown((count) => {
        if (count >= text.length) {
          window.clearInterval(timer);
          return count;
        }
        return Math.min(text.length, count + 2);
      });
    }, 22);
    return () => window.clearInterval(timer);
  }, [text]);
  return (
    <span className={className}>
      <span aria-hidden="true">{text.slice(0, shown)}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

/** Blue bar under HP: the armor's shield, spent before HP. */
export function ShieldBar({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div
      className="ui-hp mt-0.5"
      role="meter"
      aria-label="Shield armor"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.max(0, Math.round(value))}
    >
      <span className="ui-hp-tag is-shield">SH</span>
      <span className="ui-hp-track">
        <span className="ui-hp-fill block" data-level="shield" style={{ width: `${ratio * 100}%` }} />
      </span>
    </div>
  );
}
