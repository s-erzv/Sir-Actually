"use client";

import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { bus, type GameEvents } from "@/game/bus";
import { buildFloorPlan } from "@/game/map/buildFloorPlan";
import { generateFloorFromPlan } from "@/game/map/generateFloor";
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
    return generateFloorFromPlan(buildFloorPlan(findings, true)[0]!, seed);
  }, [seed]);

  useEffect(() => {
    // Handles for scripted checks in the browser console.
    Object.assign(window, { __bus: bus, __floor: floorMap });
  }, [floorMap]);

  useEffect(() => {
    const onStart = (event: GameEvents["encounter:start"]) => setEncounter(event);
    bus.on("encounter:start", onStart);
    return () => bus.off("encounter:start", onStart);
  }, []);

  const hit = (damage: number, heartLost = false) => {
    if (encounter) bus.emit("boss:hit", { encounterId: encounter.encounterId, damage, heartLost });
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
          <>
            <span className="bg-red-900/80 px-2 py-1">lawan: {encounter.bossSlug}</span>
            <button className="border border-white/40 bg-black/70 px-2 py-1" onClick={() => hit(20)}>serang 20</button>
            <button className="border border-white/40 bg-black/70 px-2 py-1" onClick={() => hit(45)}>serang 45</button>
            <button className="border border-white/40 bg-black/70 px-2 py-1" onClick={() => hit(0, true)}>meleset + Heart</button>
            <button className="border border-white/40 bg-black/70 px-2 py-1" onClick={() => end("won")}>bunuh</button>
            <button className="border border-white/40 bg-black/70 px-2 py-1" onClick={() => end("fled")}>kabur</button>
          </>
        ) : (
          <span className="bg-black/70 px-2 py-1">jalan (WASD/panah) ke monster</span>
        )}
      </div>
    </main>
  );
}
