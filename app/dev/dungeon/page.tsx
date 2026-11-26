"use client";

import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { bus, type GameEvents } from "@/game/bus";
import { buildFloorPlan } from "@/game/map/buildFloorPlan";
import { generateFloorFromPlan } from "@/game/map/generateFloor";
import { placeDwellers } from "@/lib/dungeon/dwellers";
import { resolveCombat } from "@/lib/combat/resolve";
import type { FindingStub, WeaknessType } from "@/lib/domain/types";

const PhaserGame = dynamic(() => import("@/game/PhaserGame"), { ssr: false });

const TYPES: WeaknessType[] = [
  "rq_method_mismatch",
  "sample_unreported",
  "generalization_beyond_sample",
  "limitation_missing",
  "sample_unreported",
  "rq_method_mismatch",
];

/**
 * /dev/dungeon — the dungeon scene on a fixture floor, no account or LLM.
 * Walk into a monster, then use the buttons to play a hit, a counter-attack
 * or a kill. Development only.
 */
export default function DevDungeonPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const [seed, setSeed] = useState(20261101);
  const [character, setCharacter] = useState("arka");
  const [encounter, setEncounter] = useState<GameEvents["encounter:start"] | null>(null);

  const floorMap = useMemo(() => {
    const findings: FindingStub[] = TYPES.map((weaknessType, index) => ({
      id: `dev-${index}`,
      weaknessType,
      severity: 2,
      centrality: 2,
      confidence: 0.8,
      evidenceQuote: "kutipan contoh",
      floor: 1,
      rank: index + 1,
    }));
    const map = generateFloorFromPlan(buildFloorPlan(findings, true)[0]!, seed);
    // Two fake dwellers so the comprehension encounter can be previewed.
    return { ...map, dwellers: placeDwellers(map, 2) };
  }, [seed]);

  useEffect(() => {
    // Handles for scripted checks in the browser console.
    Object.assign(window, { __bus: bus, __floor: floorMap });
  }, [floorMap]);

  useEffect(() => {
    const onStart = (event: GameEvents["encounter:start"]) => {
      setEncounter(event);
      setMonsterHp(80);
    };
    bus.on("encounter:start", onStart);
    return () => bus.off("encounter:start", onStart);
  }, []);

  const [monsterHp, setMonsterHp] = useState(80);
  const hit = (quality: 0 | 1 | 2 | 3 | 4 | 5) => {
    if (!encounter) return;
    const combat = resolveCombat({
      answer: "Contoh jawaban pratinjau yang cukup panjang untuk dinilai.",
      sourceText: "kutipan contoh",
      citations: [],
      enemyHpRatio: monsterHp / 80,
      firstAnswer: true,
      characterSlug: character,
      quality,
      usedEvidence: quality >= 2,
      monsterAttack: 20,
      shieldAvailable: true,
    });
    const nextHp = Math.max(0, monsterHp - combat.damage);
    setMonsterHp(nextHp);
    bus.emit("boss:hit", {
      encounterId: encounter.encounterId,
      damage: combat.damage,
      quality: combat.quality,
      qualityLabel: combat.qualityLabel,
      attackStyle: combat.attackStyle,
      counterDamage: combat.counterDamage,
      shielded: combat.shielded,
      monsterHp: nextHp,
      monsterHpMax: 80,
    });
  };
  const end = (result: "won" | "fled") => {
    if (!encounter) return;
    bus.emit("encounter:end", { encounterId: encounter.encounterId, result });
    setEncounter(null);
  };

  return (
    <main className="game-immersive fixed inset-0 bg-[#0D0F15]">
      <div id="game-root" className="absolute inset-0" />
      <PhaserGame key={`${seed}-${character}`} floorMap={floorMap} characterSlug={character} />
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2 text-xs text-white">
        <button className="border border-white/40 bg-black/70 px-2 py-1" onClick={() => setSeed((s) => s + 1)}>
          peta baru ({seed})
        </button>
        {["arka", "mira", "sena", "kiran", "vara"].map((slug) => (
          <button key={slug} className="border border-white/40 bg-black/70 px-2 py-1" onClick={() => setCharacter(slug)}>
            {slug}
          </button>
        ))}
        {encounter ? (
          <div className="w-full border border-amber-300/50 bg-black/80 p-2">
            <p className="mb-1 text-[0.6rem] uppercase tracking-[0.12em] text-amber-200">
              Pratinjau visual — bukan pertanyaan asli
            </p>
            <p className="mb-2 max-w-xl text-[0.72rem] leading-5 text-white">
              Lawan: {encounter.bossSlug}. Jelaskan dengan kata-katamu sendiri apa maksud
              bagian ini dan apa dasarnya di naskahmu?
            </p>
            <div className="flex flex-wrap gap-2">
              {([0, 1, 2, 3, 4, 5] as const).map((quality) => (
                <button
                  key={quality}
                  className="border border-white/40 bg-black/70 px-2 py-1"
                  onClick={() => hit(quality)}
                >
                  Q{quality}
                </button>
              ))}
              <button className="border border-white/40 bg-black/70 px-2 py-1" onClick={() => end("won")}>bunuh</button>
              <button className="border border-white/40 bg-black/70 px-2 py-1" onClick={() => end("fled")}>kabur</button>
            </div>
          </div>
        ) : (
          <span className="bg-black/70 px-2 py-1">PREVIEW · jalan (WASD/panah) ke monster atau penghuni</span>
        )}
      </div>
    </main>
  );
}
