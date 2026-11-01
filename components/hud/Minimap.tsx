"use client";

import { useEffect, useRef } from "react";
import type { FloorMap } from "@/lib/domain/types";
import { bus } from "@/game/bus";

interface MinimapProps {
  floorMap: FloorMap;
}

const PX = 3; // pixels per tile

const COLOUR_VOID    = "transparent";
const COLOUR_FLOOR   = "#3a3a5c";
const COLOUR_WALL    = "#1a1a2e";
const COLOUR_DONE    = "#44bb44";   // resolved room
const COLOUR_CURRENT = "#ddcc00";   // room player is in
const COLOUR_BOSS    = "#cc2222";   // boss room (hidden until entered)
const COLOUR_PLAYER  = "#ffffff";

/**
 * Minimap — 3px/tile canvas drawn above the dungeon.
 * Green = resolved rooms, yellow = current room, red = boss room (revealed on entry).
 */
export default function Minimap({ floorMap }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    resolvedRoomIds: new Set<string>(),
    currentRoomId: "",
    revealedBossId: "",
    playerTile: floorMap.playerSpawn,
  });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { tiles, width, height, rooms } = floorMap;
    const { resolvedRoomIds, currentRoomId, revealedBossId, playerTile } = stateRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw tiles
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const code = tiles[y]?.[x] ?? 0;
        if (code === 0) continue; // VOID

        // Check which room this tile belongs to
        const room = rooms.find(
          (r) => x >= r.rect.x && x < r.rect.x + r.rect.width
            && y >= r.rect.y && y < r.rect.y + r.rect.height,
        );

        let colour = COLOUR_FLOOR;
        if (code === 1 || code === 3 || code === 7 || code === 8) {
          colour = COLOUR_WALL; // WALL_TOP, WALL_FACE, WALL_DECOR, BANNER_RED
        } else if (room) {
          if (resolvedRoomIds.has(room.id)) {
            colour = COLOUR_DONE;
          } else if (room.id === currentRoomId) {
            colour = COLOUR_CURRENT;
          } else if (room.isBoss && room.id !== revealedBossId) {
            // Boss hidden — draw as void
            continue;
          } else if (room.isBoss) {
            colour = COLOUR_BOSS;
          }
        }

        ctx.fillStyle = colour;
        ctx.fillRect(x * PX, y * PX, PX, PX);
      }
    }

    // Draw player dot
    ctx.fillStyle = COLOUR_PLAYER;
    ctx.fillRect(playerTile.x * PX, playerTile.y * PX, PX, PX);
  };

  useEffect(() => {
    draw();

    const onEncounterStart = (evt: { encounterId: string; room: number }) => {
      // Reveal room
      const room = floorMap.rooms[evt.room];
      if (room?.isBoss) stateRef.current.revealedBossId = room.id;
      stateRef.current.currentRoomId = room?.id ?? "";
      draw();
    };

    const onEncounterEnd = (_evt: { encounterId: string; result: "won" | "conceded" | "disputed" | "fled" }) => {
      // Mark resolved
      const room = floorMap.rooms.find((r) =>
        r.id === stateRef.current.currentRoomId,
      );
      if (room) stateRef.current.resolvedRoomIds.add(room.id);
      stateRef.current.currentRoomId = "";
      draw();
    };

    const onHeartsReset = () => {
      stateRef.current.resolvedRoomIds.clear();
      stateRef.current.currentRoomId = "";
      draw();
    };

    bus.on("encounter:start", onEncounterStart);
    bus.on("encounter:end", onEncounterEnd);
    bus.on("hearts:reset", onHeartsReset);
    return () => {
      bus.off("encounter:start", onEncounterStart);
      bus.off("encounter:end", onEncounterEnd);
      bus.off("hearts:reset", onHeartsReset);
    };
  }, [floorMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const canvasW = floorMap.width * PX;
  const canvasH = floorMap.height * PX;

  return (
    <div className="pointer-events-none absolute bottom-2 right-2 z-10 border-2 border-void bg-[#0a0f14]/90 p-1.5 shadow-[inset_0_0_0_1px_#34424e,4px_4px_0_rgba(0,0,0,0.35)]">
      <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
        <span className="font-pixel text-[0.46rem] text-gold">Peta</span>
        <span className="font-pixel text-[0.42rem] text-ash">F{floorMap.floorOrder}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        style={{
          imageRendering: "pixelated",
          background: "rgba(7,6,11,0.82)",
          display: "block",
        }}
        aria-label="Minimap"
      />
    </div>
  );
}
