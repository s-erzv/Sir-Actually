"use client";

import { useEffect, useRef } from "react";
import { bus } from "@/game/bus";
import type { ControlScheme } from "@/lib/gameSettings";

const DIRECTIONS = [
  { dir: "up" as const, label: "Atas", className: "col-start-2 row-start-1" },
  { dir: "left" as const, label: "Kiri", className: "col-start-1 row-start-2" },
  { dir: "right" as const, label: "Kanan", className: "col-start-3 row-start-2" },
  { dir: "down" as const, label: "Bawah", className: "col-start-2 row-start-3" },
];

type Direction = (typeof DIRECTIONS)[number]["dir"];

const STEP_MS = 170;

interface TouchControlsProps {
  potions?: number;
  potionBusy?: boolean;
  scheme?: ControlScheme;
  onUsePotion?: () => void;
  onPause?: () => void;
  onSettings?: () => void;
}

/** Touch controls; hidden entirely on mouse/keyboard devices. */
export default function TouchControls({
  potions = 0,
  potionBusy = false,
  scheme = "dpad",
  onUsePotion,
  onPause,
  onSettings,
}: TouchControlsProps) {
  const holdRef = useRef<number | null>(null);
  const joystickZoneRef = useRef<HTMLDivElement>(null);

  const stop = () => {
    if (holdRef.current !== null) {
      window.clearInterval(holdRef.current);
      holdRef.current = null;
    }
  };

  const start = (dir: Direction) => {
    stop();
    bus.emit("player:step", { dir });
    holdRef.current = window.setInterval(() => {
      bus.emit("player:step", { dir });
    }, STEP_MS);
  };

  useEffect(() => stop, []);

  useEffect(() => {
    if (scheme !== "stick" || !joystickZoneRef.current) return;
    const zone = joystickZoneRef.current;
    if (zone.clientWidth === 0) return;
    let cancelled = false;
    let manager: { destroy: () => void } | null = null;
    let lastDir: Direction | null = null;
    let timer: number | null = null;

    const stopStick = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
      lastDir = null;
    };

    void import("nipplejs").then(({ default: nipplejs }) => {
      if (cancelled) return;
      const created = nipplejs.create({
        zone,
        mode: "static",
        color: "#e9b85d",
        size: 104,
        restOpacity: 0.7,
      });
      manager = created;
      created.on("move", (event) => {
        const data = event.data;
        const force = data.force ?? 0;
        if (force < 0.25) {
          stopStick();
          return;
        }
        const dir = data.direction?.angle;
        if (!dir || dir === lastDir) return;
        stopStick();
        lastDir = dir;
        bus.emit("player:step", { dir });
        timer = window.setInterval(() => bus.emit("player:step", { dir }), STEP_MS);
      });
      created.on("end", stopStick);
    });

    return () => {
      cancelled = true;
      stopStick();
      manager?.destroy();
    };
  }, [scheme]);

  return (
    <>
      {scheme === "dpad" ? (
        <div
          className="absolute left-3 z-20 hidden grid-cols-3 grid-rows-3 gap-1 [@media(pointer:coarse)]:grid"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.9rem)" }}
          aria-label="Kontrol gerak"
        >
          {DIRECTIONS.map(({ dir, label, className }) => (
            <button
              key={dir}
              type="button"
              aria-label={label}
              className={`grid h-12 w-12 place-items-center border-2 border-gold/60 bg-[#0a0f14]/90 font-pixel text-base text-gold shadow-[3px_3px_0_#05080b] active:bg-gold/20 ${className}`}
              style={{ touchAction: "none" }}
              onPointerDown={(event) => {
                event.preventDefault();
                start(dir);
              }}
              onPointerUp={stop}
              onPointerLeave={stop}
              onPointerCancel={stop}
              onContextMenu={(event) => event.preventDefault()}
            >
              {dir === "up" ? "↑" : dir === "down" ? "↓" : dir === "left" ? "←" : "→"}
            </button>
          ))}
        </div>
      ) : (
        <div
          ref={joystickZoneRef}
          className="absolute left-2 z-20 hidden h-36 w-36 touch-none [@media(pointer:coarse)]:block"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.4rem)" }}
          aria-label="Stik gerak"
        />
      )}

      <div
        className="absolute right-3 z-20 hidden flex-col items-end gap-2 [@media(pointer:coarse)]:flex"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.9rem)" }}
        aria-label="Aksi"
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => bus.emit("camera:zoom", { delta: -0.5 })}
            aria-label="Perkecil peta"
            className="grid h-11 w-11 place-items-center border-2 border-ridge bg-[#0a0f14]/90 font-pixel text-base text-bone shadow-[3px_3px_0_#05080b] active:bg-ridge/40"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => bus.emit("camera:zoom", { delta: 0.5 })}
            aria-label="Perbesar peta"
            className="grid h-11 w-11 place-items-center border-2 border-ridge bg-[#0a0f14]/90 font-pixel text-base text-bone shadow-[3px_3px_0_#05080b] active:bg-ridge/40"
          >
            +
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onUsePotion}
            disabled={!onUsePotion || potions <= 0 || potionBusy}
            className="grid h-12 w-12 place-items-center border-2 border-moss/60 bg-[#0a0f14]/90 font-pixel text-[0.5rem] uppercase text-moss shadow-[3px_3px_0_#05080b] disabled:opacity-40"
          >
            {potionBusy ? "..." : `Potion ${potions}`}
          </button>
          <button
            type="button"
            onClick={onPause}
            className="grid h-12 w-12 place-items-center border-2 border-ridge bg-[#0a0f14]/90 font-pixel text-[0.5rem] uppercase text-bone shadow-[3px_3px_0_#05080b]"
          >
            Jeda
          </button>
        </div>
        <button
          type="button"
          onClick={onSettings}
          className="grid h-9 w-[6.1rem] place-items-center border-2 border-ridge bg-[#0a0f14]/90 font-pixel text-[0.48rem] uppercase tracking-[0.08em] text-ash shadow-[3px_3px_0_#05080b]"
        >
          Atur
        </button>
      </div>
    </>
  );
}
