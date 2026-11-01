"use client";

import { useEffect, useState } from "react";
import { bus } from "@/game/bus";
import { HEARTS_START } from "@/lib/balance";
import type { DungeonDimension, FloorMap } from "@/lib/domain/types";

interface GameHudProps {
  floorMap: FloorMap;
  hearts: number;
  heartsMax?: number;
  points?: number;
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

export default function GameHud({ floorMap, hearts, heartsMax = HEARTS_START, points = 0 }: GameHudProps) {
  const [roomCurrent, setRoomCurrent] = useState(0);
  const [resolvedRooms, setResolvedRooms] = useState<Set<number>>(new Set());

  useEffect(() => {
    const onEncounterStart = (evt: { room: number }) => {
      setRoomCurrent(evt.room);
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
  }, [roomCurrent]);

  useEffect(() => {
    setRoomCurrent(0);
    setResolvedRooms(new Set());
  }, [floorMap]);

  const floorName = floorMap.dimension
    ? DIMENSION_NAMES[floorMap.dimension]
    : (FLOOR_NAMES[floorMap.floorOrder] ?? `Lantai ${floorMap.floorOrder}`);

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
      <div className="mt-1.5 flex gap-0.5" aria-label={`${resolvedRooms.size} dari ${floorMap.rooms.length} ruang selesai`}>
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
        <div className="flex gap-1" aria-label={`${hearts} nyawa tersisa`}>
          {Array.from({ length: heartsMax }).map((_, i) => (
            <span key={i} className={i < hearts ? "text-blood" : "text-ash/35"}>
              <Heart />
            </span>
          ))}
        </div>
        <span key={points} className="points-pop font-pixel text-[0.46rem] text-ash">
          {points} poin
        </span>
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
