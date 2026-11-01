"use client";

import { useEffect, useRef } from "react";
import { PixelSprite, type SpriteKind } from "@/components/brand/PixelSprite";

interface FloorIntroProps {
  floorOrder: number;
  floorTotal: number;
  floorName: string;
  bossName: string;
  bossSprite: SpriteKind;
  theme?: string;
  lore?: string;
  roomCount: number;
  monsterCount: number;
  onEnter: () => void;
}

export default function FloorIntro({
  floorOrder,
  floorTotal,
  floorName,
  bossName,
  bossSprite,
  theme,
  lore,
  roomCount,
  monsterCount,
  onEnter,
}: FloorIntroProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onEnter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnter]);

  return (
    <div
      className="game-fade fixed inset-0 z-[60] grid place-items-center bg-[#05080b]/92 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Lantai ${floorOrder}: ${floorName}`}
    >
      <div className="game-screen-in w-full max-w-lg border-2 border-gold bg-[#0a0f14] shadow-[8px_8px_0_#05080b,0_0_60px_rgba(233,184,93,0.12)]">
        <div className="flex items-center justify-between border-b-2 border-void bg-tomb px-4 py-2">
          <span className="font-pixel text-[0.56rem] text-gold">
            LANTAI {String(floorOrder).padStart(2, "0")} / {String(floorTotal).padStart(2, "0")}
          </span>
          <span className="flex items-center gap-1.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-ember">
            <span className="h-2 w-2 animate-flicker bg-ember" aria-hidden="true" />
            Pintu terbuka
          </span>
        </div>

        <div className="tile-floor relative flex h-48 items-end justify-center overflow-hidden border-b-2 border-void">
          <div className="wall-stone absolute inset-x-0 top-0 h-7 border-b-2 border-void" />
          <div className="wall-stone absolute inset-x-0 bottom-0 h-6 border-t-2 border-void" />
          <span className="torch-flame absolute left-6 top-10" />
          <span className="torch-flame absolute right-6 top-10" />
          <div className="pointer-events-none absolute bottom-9 h-20 w-40 rounded-full bg-gold/15 blur-2xl" aria-hidden="true" />
          <div className="absolute bottom-8 h-3 w-28 bg-black/50 blur-[1px]" aria-hidden="true" />
          <PixelSprite
            kind={bossSprite}
            size={bossSprite === "sir" ? 118 : 96}
            className="relative -mb-1 animate-floaty drop-shadow-[0_6px_0_rgba(0,0,0,0.5)]"
          />
        </div>

        <div className="p-5">
          <p className="eyebrow">{floorName}</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-bone">{bossName}</h2>
          <p className="mt-2 text-sm leading-6 text-ash">
            {lore ?? theme ?? "Penguji menunggu di ujung lorong. Bawa bukti, bukan keberanian kosong."}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="border border-ridge/60 bg-void/50 px-3 py-2">
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.08em] text-ash">Ruang</p>
              <p className="mt-1 font-pixel text-sm text-bone">{roomCount}</p>
            </div>
            <div className="border border-ridge/60 bg-void/50 px-3 py-2">
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.08em] text-ash">Musuh</p>
              <p className="mt-1 font-pixel text-sm text-bone">{monsterCount}</p>
            </div>
          </div>

          <button
            ref={buttonRef}
            type="button"
            onClick={onEnter}
            className="pixel-button mt-5 w-full border-gold bg-gold text-void hover:bg-bone"
          >
            Masuk lantai <span aria-hidden="true">→</span>
          </button>
          <p className="mt-2 text-center text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash/70">
            Enter / Spasi untuk lanjut
          </p>
        </div>
      </div>
    </div>
  );
}
