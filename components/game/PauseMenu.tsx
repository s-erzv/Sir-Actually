"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CharacterPortrait } from "@/components/brand/Portrait";
import { getCharacter, getWeapon } from "@/lib/loadout";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { Loadout } from "@/lib/loadout";
import { getShakeMode, setShakeMode, type ShakeMode } from "@/game/feel";

interface PauseMenuProps {
  dungeonTitle: string;
  floorLabel: string;
  points: number;
  hearts: number;
  heartsMax: number;
  loadout: Loadout;
  playerName?: string;
  findingsHref?: string;
  onResume: () => void;
  onOpenSettings?: () => void;
  onOpenShop?: () => void;
}

export default function PauseMenu({
  dungeonTitle,
  floorLabel,
  points,
  hearts,
  heartsMax,
  loadout,
  playerName,
  findingsHref,
  onResume,
  onOpenSettings,
  onOpenShop,
}: PauseMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>();
  const character = getCharacter(loadout.characterSlug);
  const weapon = getWeapon(loadout.weaponSlug);
  const [shake, setShake] = useState<ShakeMode>(() => getShakeMode());

  function toggleFullscreen() {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
    void request?.().catch(() => {});
  }

  useEffect(() => {
    buttonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onResume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onResume]);

  return (
    <div
      ref={dialogRef}
      className="game-fade fixed inset-0 z-[60] grid place-items-center bg-[#05080b]/90 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Jeda ekspedisi"
    >
      <div className="game-screen-in w-full max-w-md border-2 border-ridge bg-[#0a0f14] shadow-[8px_8px_0_#05080b]">
        <div className="flex items-center justify-between border-b-2 border-void bg-tomb px-4 py-2">
          <span className="font-pixel text-[0.56rem] text-gold">JEDA</span>
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-ash">
            {floorLabel}
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3 border-b-2 border-void pb-4">
            <div className="tile-floor grid h-16 w-16 shrink-0 place-items-end justify-items-center border-2 border-void pb-1.5">
              <CharacterPortrait slug={loadout.characterSlug} size={52} />
            </div>
            <div className="min-w-0">
              <p className="font-pixel text-[0.5rem] text-gold">Rakitan aktif</p>
              <p className="mt-1 truncate text-sm font-bold text-bone">
                {playerName ?? character?.name ?? "Penjaga"} · {weapon?.name ?? "Senjata"}
              </p>
              <p className="mt-1 text-[0.68rem] text-ash">
                {hearts}/{heartsMax} Heart · {points} koin
              </p>
            </div>
          </div>

          <p className="mt-4 truncate text-xs uppercase tracking-[0.08em] text-ash">
            {dungeonTitle}
          </p>

          <button
            ref={buttonRef}
            type="button"
            onClick={onResume}
            className="pixel-button mt-4 w-full border-gold bg-gold text-void hover:bg-bone"
          >
            Lanjutkan
          </button>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="pixel-button pixel-button-sm border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold"
            >
              Layar penuh
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              disabled={!onOpenSettings}
              className="pixel-button pixel-button-sm border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold disabled:opacity-40"
            >
              Pengaturan
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenShop}
            disabled={!onOpenShop}
            className="pixel-button pixel-button-sm mt-2 w-full border-gold/60 bg-gold/10 text-gold hover:bg-gold hover:text-void disabled:opacity-40"
          >
            Toko · {points} koin
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {findingsHref ? (
              <Link
                href={findingsHref}
                className="pixel-button pixel-button-sm border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold"
              >
                Temuan
              </Link>
            ) : (
              <span />
            )}
            <Link
              href="/dashboard"
              className="pixel-button pixel-button-sm border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold"
            >
              Ke kamp
            </Link>
          </div>
          <Link
            href="/"
            className="pixel-button pixel-button-sm mt-2 w-full border-ridge bg-tomb/80 text-ash hover:border-blood hover:text-blood"
          >
            Keluar dari dungeon
          </Link>

          <div className="mt-4 border-t-2 border-void pt-3">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-ash">
              Guncangan layar
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {(["off", "soft", "full"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setShakeMode(mode);
                    setShake(mode);
                  }}
                  className={`border px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.06em] ${
                    shake === mode
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-ridge/60 bg-void/50 text-ash hover:border-gold/60"
                  }`}
                >
                  {mode === "off" ? "Mati" : mode === "soft" ? "Halus" : "Penuh"}
                </button>
              ))}
            </div>
          </div>

          <dl className="mt-4 space-y-1.5 border-t-2 border-void pt-3 text-[0.68rem]">
            <div className="flex justify-between gap-3">
              <dt className="text-ash">Gerak</dt>
              <dd className="font-bold text-bone">WASD / panah</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ash">Hadapi monster</dt>
              <dd className="font-bold text-bone">Tabrak / sentuh</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ash">Jeda</dt>
              <dd className="font-bold text-bone">Esc</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
