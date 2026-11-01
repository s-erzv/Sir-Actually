"use client";

import { useEffect, useState } from "react";
import { bus } from "@/game/bus";
import { HEARTS_START } from "@/lib/balance";
import type { FloorMap } from "@/lib/domain/types";

interface GameHudProps {
  floorMap: FloorMap;
  hearts: number;
}

const FLOOR_NAMES = [
  "",
  "Veylith · Gap Hunter",
  "Draeven · The Aligner",
  "Kryvax · Methodologist",
  "Morvane · The Auditor",
  "Nyxara · Ghost Library",
  "Eldravos · Final Boss",
];

export default function GameHud({ floorMap, hearts }: GameHudProps) {
  const [roomCurrent, setRoomCurrent] = useState(0);

  useEffect(() => {
    const onEncounterStart = (evt: { room: number }) => {
      setRoomCurrent(evt.room);
    };
    const onFloorRetry = () => {
      setRoomCurrent(0);
    };

    bus.on("encounter:start", onEncounterStart);
    bus.on("floor:retry", onFloorRetry);
    return () => {
      bus.off("encounter:start", onEncounterStart);
      bus.off("floor:retry", onFloorRetry);
    };
  }, []);

  const floorName = FLOOR_NAMES[floorMap.floorOrder] ?? `Lantai ${floorMap.floorOrder}`;

  return (
    <div
      className="pointer-events-none absolute left-2 top-2 z-10 w-[11.5rem] border-2 border-void bg-[#0a0f14]/92 p-2.5 shadow-[inset_0_0_0_1px_#34424e,4px_4px_0_rgba(0,0,0,0.35)]"
      aria-label="HUD"
    >
      <div className="flex items-center justify-between gap-2 border-b border-ridge/60 pb-1.5">
        <span className="font-pixel text-[0.5rem] text-gold">Lantai {floorMap.floorOrder}</span>
        <span className="font-pixel text-[0.46rem] text-ash">
          {roomCurrent + 1}/{floorMap.rooms.length || 0}
        </span>
      </div>
      <div className="mt-1.5 truncate text-[0.7rem] font-bold text-bone">{floorName}</div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex gap-1" aria-label={`${hearts} nyawa tersisa`}>
          {Array.from({ length: HEARTS_START }).map((_, i) => (
            <span key={i} className={i < hearts ? "text-blood" : "text-ridge/60"}>
              <Heart />
            </span>
          ))}
        </div>
        <span className="font-pixel text-[0.46rem] text-ash">HP</span>
      </div>
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
