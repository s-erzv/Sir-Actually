"use client";

import { bus } from "@/game/bus";

const DIRECTIONS = [
  { dir: "up" as const, label: "Atas", className: "col-start-2 row-start-1" },
  { dir: "left" as const, label: "Kiri", className: "col-start-1 row-start-2" },
  { dir: "right" as const, label: "Kanan", className: "col-start-3 row-start-2" },
  { dir: "down" as const, label: "Bawah", className: "col-start-2 row-start-3" },
];

/** Touch-only D-pad; each tap moves exactly one tile. */
export default function TouchControls() {
  return (
    <div
      className="absolute bottom-4 left-4 z-20 grid grid-cols-3 grid-rows-3 gap-1 md:hidden"
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
            bus.emit("player:step", { dir });
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          {dir === "up" ? "↑" : dir === "down" ? "↓" : dir === "left" ? "←" : "→"}
        </button>
      ))}
    </div>
  );
}
