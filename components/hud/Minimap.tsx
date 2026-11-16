"use client";

import { useEffect, useRef } from "react";
import type { FloorMap, Room } from "@/lib/domain/types";
import { bus } from "@/game/bus";
import { revealedTileKeys } from "@/lib/dungeon/fog";

interface MinimapProps {
  floorMap: FloorMap;
  storageKey?: string;
  resolvedKeys?: readonly string[];
}

const PX = 3; // pixels per tile
const FOG_RADIUS = 2; // tiles revealed around the player

const COLOUR_FLOOR   = "#3a3a5c";
const COLOUR_WALL    = "#1a1a2e";
const COLOUR_DONE    = "#44bb44";   // resolved room
const COLOUR_CURRENT = "#ddcc00";   // room player is in
const COLOUR_BOSS    = "#cc2222";   // boss room
const COLOUR_PLAYER  = "#ffffff";

function roomAt(rooms: readonly Room[], x: number, y: number): Room | undefined {
  return rooms.find(
    (room) =>
      x >= room.rect.x &&
      x < room.rect.x + room.rect.width &&
      y >= room.rect.y &&
      y < room.rect.y + room.rect.height,
  );
}

/**
 * Minimap with fog of war: only tiles the player has walked near are shown.
 * Green = resolved rooms, yellow = current room, red = boss room.
 */
export default function Minimap({ floorMap, storageKey, resolvedKeys }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    resolvedRoomIds: new Set<string>(),
    currentRoomId: "",
    explored: new Set<string>(),
    playerTile: floorMap.playerSpawn,
  });

  const revealAround = (x: number, y: number, radius = FOG_RADIUS) => {
    const explored = stateRef.current.explored;
    for (const key of revealedTileKeys(floorMap.width, floorMap.height, x, y, radius)) {
      explored.add(key);
    }
  };

  const revealRoom = (room: Room) => {
    const explored = stateRef.current.explored;
    for (let ty = room.rect.y; ty < room.rect.y + room.rect.height; ty += 1) {
      for (let tx = room.rect.x; tx < room.rect.x + room.rect.width; tx += 1) {
        explored.add(`${tx},${ty}`);
      }
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { tiles, width, height, rooms } = floorMap;
    const { resolvedRoomIds, currentRoomId, explored, playerTile } = stateRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw only explored tiles: the map is dark until walked.
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!explored.has(`${x},${y}`)) continue;
        const code = tiles[y]?.[x] ?? 0;
        if (code === 0) continue;

        let colour = COLOUR_FLOOR;
        if (code === 1 || code === 3 || code === 7 || code === 8) {
          colour = COLOUR_WALL;
        } else {
          const room = roomAt(rooms, x, y);
          if (room) {
            if (resolvedRoomIds.has(room.id)) {
              colour = COLOUR_DONE;
            } else if (room.id === currentRoomId) {
              colour = COLOUR_CURRENT;
            } else if (room.isBoss) {
              colour = COLOUR_BOSS;
            }
          }
        }

        ctx.fillStyle = colour;
        ctx.fillRect(x * PX, y * PX, PX, PX);
      }
    }

    ctx.fillStyle = COLOUR_PLAYER;
    ctx.fillRect(playerTile.x * PX, playerTile.y * PX, PX, PX);
  };

  useEffect(() => {
    const fogKey =
      storageKey ??
      `fog:${floorMap.floorOrder}:${floorMap.dimension ?? ""}:${floorMap.width}x${floorMap.height}`;

    const saveFog = () => {
      try {
        sessionStorage.setItem(fogKey, JSON.stringify([...stateRef.current.explored]));
      } catch {
        // Storage can be unavailable in private mode.
      }
    };

    const resetFog = () => {
      const state = stateRef.current;
      state.explored.clear();
      state.resolvedRoomIds.clear();
      state.currentRoomId = "";
      state.playerTile = floorMap.playerSpawn;

      // Resuming a run: seed finished rooms from the server-derived keys.
      const resolved = new Set(resolvedKeys ?? []);
      for (const room of floorMap.rooms) {
        const spawns = room.monsterSpawns ?? [room.monsterSpawn];
        if (
          spawns.length > 0 &&
          spawns.every((_, index) => resolved.has(`${room.id}:${index}`))
        ) {
          state.resolvedRoomIds.add(room.id);
        }
      }

      try {
        const saved = sessionStorage.getItem(fogKey);
        const keys = saved ? (JSON.parse(saved) as unknown) : null;
        if (Array.isArray(keys)) {
          for (const key of keys) {
            if (typeof key === "string") state.explored.add(key);
          }
        }
      } catch {
        // Ignore corrupt fog data.
      }
      revealAround(floorMap.playerSpawn.x, floorMap.playerSpawn.y, FOG_RADIUS + 1);
      saveFog();
      draw();
    };
    resetFog();

    const onPlayerMoved = (tile: { x: number; y: number }) => {
      const state = stateRef.current;
      state.playerTile = tile;
      revealAround(tile.x, tile.y);
      const room = roomAt(floorMap.rooms, tile.x, tile.y);
      state.currentRoomId = room?.id ?? "";
      draw();
      saveFog();
    };

    const onEncounterStart = (evt: { encounterId: string; room: number }) => {
      const room = floorMap.rooms[evt.room];
      if (room) {
        revealRoom(room);
        stateRef.current.currentRoomId = room.id;
      }
      draw();
      saveFog();
    };

    const onEncounterEnd = () => {
      const state = stateRef.current;
      const room = floorMap.rooms.find((r) => r.id === state.currentRoomId);
      if (room) state.resolvedRoomIds.add(room.id);
      state.currentRoomId = "";
      draw();
    };

    const onHeartsReset = () => {
      stateRef.current.resolvedRoomIds.clear();
      stateRef.current.currentRoomId = "";
      draw();
    };

    bus.on("player:moved", onPlayerMoved);
    bus.on("encounter:start", onEncounterStart);
    bus.on("encounter:end", onEncounterEnd);
    bus.on("hearts:reset", onHeartsReset);
    return () => {
      bus.off("player:moved", onPlayerMoved);
      bus.off("encounter:start", onEncounterStart);
      bus.off("encounter:end", onEncounterEnd);
      bus.off("hearts:reset", onHeartsReset);
    };
  }, [floorMap, storageKey, resolvedKeys]); // eslint-disable-line react-hooks/exhaustive-deps

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
