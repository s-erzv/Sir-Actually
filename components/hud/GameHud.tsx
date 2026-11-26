"use client";

import { useEffect, useState } from "react";
import { bus } from "@/game/bus";
import { HEART_HP, HEARTS_START, POTION_BAG_MAX } from "@/lib/balance";
import type { DungeonDimension, FloorMap } from "@/lib/domain/types";

interface GameHudProps {
  floorMap: FloorMap;
  hearts: number;
  heartsMax?: number;
  points?: number;
  /** Total player HP; when present, Hearts render as partial containers. */
  hp?: number;
  hpMax?: number;
  potions?: number;
  potionBusy?: boolean;
  onUsePotion?: () => void;
}

const DIMENSION_NAMES: Record<DungeonDimension, string> = {
  gap: "Veylith · Gap Hunter",
  align: "Draeven · The Aligner",
  method: "Kryvax · Methodologist",
  audit: "Morvane · The Auditor",
  ghost: "Nyxara · Ghost Library",
  throne: "Eldravos · Final Boss",
};

const FLOOR_NAMES = [
  "",
  "Veylith · Gap Hunter",
  "Draeven · The Aligner",
  "Kryvax · Methodologist",
  "Morvane · The Auditor",
  "Nyxara · Ghost Library",
  "Eldravos · Final Boss",
];

export default function GameHud({
  floorMap,
  hearts,
  heartsMax = HEARTS_START,
  points = 0,
  hp,
  hpMax,
  potions = 0,
  potionBusy = false,
  onUsePotion,
}: GameHudProps) {
  const [roomCurrent, setRoomCurrent] = useState(0);
  const [resolvedRooms, setResolvedRooms] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) setOpen(false);
  }, []);

  useEffect(() => {
    const onEncounterStart = (evt: { room: number }) => {
      // Dwellers use room numbers above the real rooms; they are corridors.
      if (evt.room < floorMap.rooms.length) setRoomCurrent(evt.room);
    };
    const onEncounterEnd = () => {
      setResolvedRooms((current) => new Set(current).add(roomCurrent));
    };
    const onFloorRetry = () => {
      setRoomCurrent(0);
      setResolvedRooms(new Set());
    };

    bus.on("encounter:start", onEncounterStart);
    bus.on("encounter:end", onEncounterEnd);
    bus.on("floor:retry", onFloorRetry);
    return () => {
      bus.off("encounter:start", onEncounterStart);
      bus.off("encounter:end", onEncounterEnd);
      bus.off("floor:retry", onFloorRetry);
    };
  }, [roomCurrent, floorMap.rooms.length]);

  useEffect(() => {
    setRoomCurrent(0);
    setResolvedRooms(new Set());
  }, [floorMap]);

  const floorName = floorMap.dimension
    ? DIMENSION_NAMES[floorMap.dimension]
    : (FLOOR_NAMES[floorMap.floorOrder] ?? `Lantai ${floorMap.floorOrder}`);

  const heartsNode =
    hp !== undefined ? (
      <HpHearts hp={hp} hpMax={hpMax ?? heartsMax * HEART_HP} heartsMax={heartsMax} />
    ) : (
      <div className="flex gap-1" aria-label={`${hearts} nyawa tersisa`}>
        {Array.from({ length: heartsMax }).map((_, i) => (
          <span key={i} className={i < hearts ? "text-blood" : "text-ash/35"}>
            <Heart />
          </span>
        ))}
      </div>
    );

  return (
    <div
      className={`pointer-events-none absolute left-2 top-2 z-10 border-2 border-void bg-[#0a0f14]/92 shadow-[inset_0_0_0_1px_#34424e,4px_4px_0_rgba(0,0,0,0.35)] ${
        open ? "w-[11.5rem] p-2.5" : "p-1.5"
      }`}
      aria-label="HUD"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Sembunyikan info lantai" : "Tampilkan info lantai"}
        className="pointer-events-auto flex w-full items-center justify-between gap-2"
      >
        <span className="font-pixel text-[0.5rem] text-gold">Lantai {floorMap.floorOrder}</span>
        <span className="flex items-center gap-1.5">
          <span className="font-pixel text-[0.46rem] text-ash">
            {roomCurrent + 1}/{floorMap.rooms.length || 0}
          </span>
          <span aria-hidden="true" className="font-pixel text-[0.5rem] text-ash">
            {open ? "▾" : "▸"}
          </span>
        </span>
      </button>

      {open ? (
        <>
          <div className="mt-1.5 truncate border-t border-ridge/60 pt-1.5 text-[0.7rem] font-bold text-bone">
            {floorName}
          </div>
          <div
            className="mt-1.5 flex gap-0.5"
            aria-label={`${resolvedRooms.size} dari ${floorMap.rooms.length} ruang selesai`}
          >
            {floorMap.rooms.map((room, index) => (
              <span
                key={room.id}
                className={`h-1.5 flex-1 border border-void ${
                  resolvedRooms.has(index)
                    ? "bg-moss"
                    : index === roomCurrent
                      ? "bg-gold"
                      : "bg-ridge/60"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            {heartsNode}
            <span key={points} className="points-pop font-pixel text-[0.46rem] text-gold">
              {points} koin
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-pixel text-[0.46rem] uppercase tracking-[0.08em] text-ash">
              Ramuan {potions}/{POTION_BAG_MAX}
            </span>
            <button
              type="button"
              onClick={onUsePotion}
              disabled={!onUsePotion || potions <= 0 || potionBusy}
              className="pointer-events-auto border border-moss/50 bg-moss/10 px-2 py-0.5 font-pixel text-[0.46rem] uppercase tracking-[0.08em] text-moss disabled:opacity-40"
            >
              {potionBusy ? "..." : "Minum (Q)"}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {heartsNode}
          <span key={points} className="points-pop font-pixel text-[0.46rem] text-gold">
            {points}
          </span>
        </div>
      )}
    </div>
  );
}

function HpHearts({ hp, hpMax, heartsMax }: { hp: number; hpMax: number; heartsMax: number }) {
  return (
    <div className="flex gap-1" aria-label={`${hp} dari ${hpMax} HP`}>
      {Array.from({ length: heartsMax }).map((_, index) => {
        const ratio = Math.max(0, Math.min(1, (hp - index * HEART_HP) / HEART_HP));
        return (
          <span key={index} className="relative inline-flex text-ash/25">
            <Heart />
            <span
              className="absolute inset-0 overflow-hidden text-blood"
              style={{ width: `${ratio * 100}%` }}
            >
              <Heart />
            </span>
          </span>
        );
      })}
    </div>
  );
}

function Heart() {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true" className="dungeon-map">
      <path
        d="M1 3 h3 v2 h2 V3 h2 v2 h3 V1 h-2 v1 H9 V1 H5 v1 H4 V1 H1 Z M1 5 v3 h2 v2 h2 v1 h4 v-1 h2 V8 h2 V5 h-3 v2 H11 V5 Z"
        fill="currentColor"
      />
    </svg>
  );
}
