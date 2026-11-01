"use client";

import { PixelSprite, heroForCharacter } from "@/components/brand/PixelSprite";
import type { CharacterSlug } from "@/lib/loadout";

interface DungeonEntryProps {
  phase: "loading" | "enter";
  dungeonTitle: string;
  characterSlug: CharacterSlug;
  floorLabel?: string;
}

export default function DungeonEntry({
  phase,
  dungeonTitle,
  characterSlug,
  floorLabel,
}: DungeonEntryProps) {
  const entering = phase === "enter";

  return (
    <div
      className={`fixed inset-0 z-[80] overflow-hidden bg-[#030507] ${entering ? "dungeon-entry-out" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={entering ? "Memasuki dungeon" : "Menyiapkan run"}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(233,184,93,0.16),transparent_55%)]" />
      <div className="dungeon-bg pointer-events-none absolute inset-0 opacity-40" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 32%, rgba(0,0,0,0.82) 100%)",
        }}
        aria-hidden="true"
      />
      <span className="torch-flame absolute left-[12%] top-[30%]" aria-hidden="true" />
      <span className="torch-flame absolute right-[12%] top-[30%]" aria-hidden="true" />
      <span className="torch-flame absolute left-[20%] bottom-[22%] opacity-70" aria-hidden="true" />
      <span className="torch-flame absolute right-[20%] bottom-[22%] opacity-70" aria-hidden="true" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center">
        <p className="font-pixel text-[0.6rem] uppercase tracking-[0.16em] text-gold">
          {entering ? "Gerbang terbuka" : "Mengunci loadout"}
        </p>

        <div className="entry-stage relative mt-9 grid place-items-center">
          <div className="entry-ring absolute h-56 w-56 rounded-full border-2 border-gold/30" aria-hidden="true" />
          <div className="entry-ring entry-ring-delay absolute h-40 w-40 rounded-full border border-ember/40" aria-hidden="true" />

          <div className={`entry-gate relative h-56 w-40 border-4 border-gold/80 bg-[#080d12] shadow-[inset_0_0_0_4px_#05080b,0_0_50px_rgba(233,184,93,0.16)] ${entering ? "entry-gate-open" : ""}`}>
            <div className="absolute inset-3 overflow-hidden bg-[linear-gradient(180deg,#16202b,#080d12_70%)]">
              <div className="entry-stairs absolute inset-x-3 bottom-0 h-20" aria-hidden="true" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(233,184,93,0.28),transparent_65%)]" />
            </div>
            <span className="absolute -left-2 -top-2 h-4 w-4 border-l-2 border-t-2 border-gold" aria-hidden="true" />
            <span className="absolute -right-2 -top-2 h-4 w-4 border-r-2 border-t-2 border-gold" aria-hidden="true" />
            <span className="absolute -bottom-2 -left-2 h-4 w-4 border-b-2 border-l-2 border-gold" aria-hidden="true" />
            <span className="absolute -bottom-2 -right-2 h-4 w-4 border-b-2 border-r-2 border-gold" aria-hidden="true" />
          </div>

          <div className={`entry-hero absolute bottom-2 ${entering ? "entry-hero-dive" : ""}`}>
            <PixelSprite
              kind={heroForCharacter(characterSlug)}
              size={96}
              className="drop-shadow-[0_8px_0_rgba(0,0,0,0.55)]"
            />
          </div>

          <span className="entry-spark entry-spark-a" aria-hidden="true" />
          <span className="entry-spark entry-spark-b" aria-hidden="true" />
          <span className="entry-spark entry-spark-c" aria-hidden="true" />
        </div>

        <h1 className="mt-8 max-w-md truncate text-2xl font-bold tracking-tight text-bone sm:text-3xl">
          {dungeonTitle || "Dungeon naskah"}
        </h1>
        <p className="mt-2 font-pixel text-[0.54rem] uppercase tracking-[0.14em] text-ash">
          {floorLabel ?? "Lantai 01"}
        </p>

        <div className="mt-7 w-full max-w-xs">
          <div className="bar-track overflow-hidden">
            <div className={entering ? "bar-fill w-full" : "entry-load-fill"} />
          </div>
          <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ash/70">
            {entering ? "Memasuki dunia game..." : "Menyiapkan lantai..."}
          </p>
        </div>
      </div>

      {entering ? <div className="entry-flash pointer-events-none absolute inset-0 bg-gold" aria-hidden="true" /> : null}
    </div>
  );
}
