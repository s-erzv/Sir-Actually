"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PixelSprite } from "@/components/brand/PixelSprite";
import { generateFloorFromPlan } from "@/game/map/generateFloor";
import { TileCode } from "@/game/map/tiles";
import { getMonsterDisplayName } from "@/lib/monsters";
import type { DungeonDimension, DungeonTier, FloorMap, FloorPlan } from "@/lib/domain/types";

const FLOOR_CODENAMES: Record<DungeonDimension, string> = {
  gap: "Retak Tanpa Jejak",
  align: "Gerbang Tak Selaras",
  method: "Ruang Yang Berubah",
  audit: "Aula Penghakiman",
  ghost: "Perpustakaan Terkutuk",
  throne: "Ruang Takhta",
};

const TILE_COLOURS: Partial<Record<TileCode, string>> = {
  [TileCode.WALL_TOP]: "#2b3a4d",
  [TileCode.WALL_FACE]: "#465d78",
  [TileCode.FLOOR]: "#1c2c3e",
  [TileCode.FLOOR_ALT]: "#263c52",
  [TileCode.DOOR_LOCKED]: "#d9713f",
  [TileCode.DOOR_OPEN]: "#8fbd72",
  [TileCode.STAIRS]: "#e9b85d",
  [TileCode.WALL_DECOR]: "#8fbd72",
  [TileCode.BANNER_RED]: "#cf5c68",
  [TileCode.PROP]: "#8a6038",
};

interface DungeonMapPreviewProps {
  title: string;
  tier: DungeonTier;
  floors: readonly FloorPlan[];
  findingCount: number;
  citationCount: number;
  href: string;
  currentFloor?: number;
  resolvedKeys?: readonly string[];
  hasActiveRun?: boolean;
}

export default function DungeonMapPreview({
  title,
  tier,
  floors,
  findingCount,
  citationCount,
  href,
  currentFloor = 1,
  resolvedKeys = [],
  hasActiveRun = false,
}: DungeonMapPreviewProps) {
  const [selectedIndex, setSelectedIndex] = useState(
    Math.min(Math.max(0, currentFloor - 1), Math.max(0, floors.length - 1)),
  );
  const resolved = useMemo(() => new Set(resolvedKeys), [resolvedKeys]);
  const floorMaps = useMemo(
    () => floors.map((floor, index) => generateFloorFromPlan(floor, 20261101 + index)),
    [floors],
  );
  const totalRooms = floors.reduce((sum, floor) => sum + floor.rooms.length, 0);
  const totalMonsters = floors.reduce((sum, floor) => sum + floor.monsterCount, 0);
  const selectedFloor = floors[selectedIndex]!;
  const selectedMap = floorMaps[selectedIndex]!;
  const selectedStatus =
    selectedFloor.floorOrder < currentFloor
      ? "done"
      : selectedFloor.floorOrder === currentFloor
        ? "current"
        : "locked";
  const bossRoom = selectedMap.rooms.find((room) => room.isBoss) ?? selectedMap.rooms.at(-1);
  const bossResolved = bossRoom ? resolved.has(`${bossRoom.id}:0`) : false;
  const completedRooms = selectedMap.rooms.filter((room) =>
    (room.monsterSpawns ?? [room.monsterSpawn]).every((_, index) =>
      resolved.has(`${room.id}:${index}`),
    ),
  ).length;

  return (
    <section className="game-screen-in">
      <div className="pixel-panel pixel-panel-gold overflow-hidden">
        <div className="relative overflow-hidden border-b-2 border-void p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(233,184,93,0.14),transparent_55%)]" aria-hidden="true" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">Dungeon atlas</p>
              <h1 className="mt-2 truncate text-2xl font-bold tracking-tight text-bone sm:text-3xl">
                {title}
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-6 text-ash">
                {hasActiveRun
                  ? `Ekspedisi aktif · lanjutkan dari lantai ${currentFloor}.`
                  : "Denah siap. Pilih lantai untuk memeriksa rute, lalu turun."}
              </p>
            </div>
            <span className="pixel-chip border-gold/40 text-gold">Tingkat {tier}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b-2 border-void bg-[#0a0f14]/80 sm:grid-cols-4">
          <Stat label="Lantai" value={String(floors.length)} />
          <Stat label="Ruang" value={String(totalRooms)} />
          <Stat label="Musuh" value={String(totalMonsters)} />
          <Stat label="Rujukan" value={String(citationCount)} />
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="border-b-2 border-void p-4 lg:border-b-0 lg:border-r-2 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-pixel text-[0.58rem] text-gold">
                  LANTAI {String(selectedFloor.floorOrder).padStart(2, "0")}
                </p>
                <h2 className="mt-1 text-xl font-bold text-bone">
                  {FLOOR_CODENAMES[selectedFloor.dimension]}
                </h2>
                <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-ash">
                  {selectedStatus === "done"
                    ? "Lantai selesai"
                    : selectedStatus === "current"
                      ? "Posisi ekspedisi"
                      : "Belum terbuka"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-pixel text-[0.56rem] text-gold">
                  {completedRooms}/{selectedMap.rooms.length} ruang
                </p>
                <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash">
                  {selectedFloor.monsterCount} musuh
                </p>
              </div>
            </div>

            <div className="relative bg-[#05080b] p-2 sm:p-3">
              <span className="torch-flame absolute left-2 top-2 z-10" aria-hidden="true" />
              <span className="torch-flame absolute right-2 top-2 z-10" aria-hidden="true" />

              <div
                className={`relative overflow-hidden border-2 border-void bg-[#070b10] ${
                  selectedStatus === "locked" ? "opacity-60 saturate-50" : ""
                }`}
              >
                <FloorCanvas map={selectedMap} />
                <div
                  className="pointer-events-none absolute inset-0 shadow-[inset_0_0_38px_rgba(0,0,0,0.8),inset_0_0_0_1px_rgba(233,184,93,0.12)]"
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0,transparent_3px,rgba(0,0,0,0.16)_3px,rgba(0,0,0,0.16)_4px)] opacity-60"
                  aria-hidden="true"
                />

                {selectedMap.rooms.filter((room) => !room.isBoss).map((room) => {
                  const roomDone = (room.monsterSpawns ?? [room.monsterSpawn]).every((_, index) =>
                    resolved.has(`${room.id}:${index}`),
                  );
                  return (
                    <RoomBadge
                      key={room.id}
                      map={selectedMap}
                      rect={room.rect}
                      label={roomDone ? "✓" : String(room.monsterSpawns?.length || 1)}
                      done={roomDone}
                      boss={room.isBoss}
                    />
                  );
                })}

                {bossRoom && !bossResolved ? (
                  <RoomBadge map={selectedMap} rect={bossRoom.rect} label="?" boss />
                ) : null}

                {selectedStatus === "current" ? (
                  <span
                    className="atlas-hero pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${((selectedMap.playerSpawn.x + 0.5) / selectedMap.width) * 100}%`,
                      top: `${((selectedMap.playerSpawn.y + 0.5) / selectedMap.height) * 100}%`,
                    }}
                  >
                    <PixelSprite kind="hero" size={26} className="drop-shadow-[0_3px_0_#000]" />
                  </span>
                ) : null}

                <span className="atlas-dust atlas-dust-a" aria-hidden="true" />
                <span className="atlas-dust atlas-dust-b" aria-hidden="true" />
                <span className="atlas-dust atlas-dust-c" aria-hidden="true" />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border border-ridge/50 bg-[#0a0f14]/75 p-3">
              <div className="flex items-center gap-3">
                <PixelSprite
                  kind={bossResolved ? "sir" : "scroll"}
                  size={34}
                  className={bossResolved ? "" : "opacity-40 grayscale"}
                />
                <div>
                  <p className="font-pixel text-[0.48rem] uppercase tracking-[0.08em] text-ash">
                    Boss lantai
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-bone">
                    {bossResolved ? getMonsterDisplayName(selectedFloor.bossSlug) : "???"}
                  </p>
                </div>
              </div>
              <span
                className={`border px-2 py-1 text-[0.54rem] font-bold uppercase tracking-[0.08em] ${
                  bossResolved
                    ? "border-moss/60 bg-moss/10 text-moss"
                    : "border-blood/40 bg-blood/10 text-blood"
                }`}
              >
                {bossResolved ? "Takluk" : "Tersembunyi"}
              </span>
            </div>
          </div>

          <aside className="bg-[#0a0f14]/55 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-pixel text-[0.56rem] text-gold">Rute ekspedisi</p>
              <span className="text-[0.56rem] font-bold uppercase tracking-[0.08em] text-ash">
                {findingCount} temuan
              </span>
            </div>

            <ol className="atlas-route mt-4 space-y-2">
              {floors.map((floor, index) => {
                const status =
                  floor.floorOrder < currentFloor
                    ? "done"
                    : floor.floorOrder === currentFloor
                      ? "current"
                      : "locked";
                const active = index === selectedIndex;
                return (
                  <li key={floor.floorOrder}>
                    <button
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      aria-pressed={active}
                      className={`atlas-floor-item w-full border-2 p-3 text-left transition ${
                        active
                          ? "border-gold bg-gold/10 shadow-[3px_3px_0_#05080b]"
                          : status === "locked"
                            ? "border-ridge/40 bg-void/35 opacity-65 hover:border-ridge"
                            : "border-ridge/60 bg-void/45 hover:border-gold/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center border font-pixel text-[0.58rem] ${
                            status === "done"
                              ? "border-moss/60 bg-moss/15 text-moss"
                              : status === "current"
                                ? "border-gold bg-gold/10 text-gold"
                                : "border-ridge bg-void/60 text-ash/60"
                          }`}
                        >
                          {status === "done" ? "✓" : String(floor.floorOrder).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-bone">
                            {FLOOR_CODENAMES[floor.dimension]}
                          </p>
                          <p className="mt-0.5 text-[0.62rem] font-bold uppercase tracking-[0.07em] text-ash">
                            {floor.rooms.length} ruang · {floor.monsterCount} musuh
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-[0.52rem] font-bold uppercase tracking-[0.07em] ${
                            status === "done"
                              ? "text-moss"
                              : status === "current"
                                ? "text-gold"
                                : "text-ash/50"
                          }`}
                        >
                          {status === "done" ? "Selesai" : status === "current" ? "Di sini" : "Terkunci"}
                        </span>
                      </div>

                      <div className="mt-2 flex gap-0.5" aria-hidden="true">
                        {floor.rooms.map((room) => {
                          const roomKey = `f${floor.floorOrder}-r${floor.rooms.indexOf(room)}:0`;
                          const roomDone = resolved.has(roomKey);
                          return (
                            <span
                              key={roomKey}
                              className={`h-1.5 flex-1 ${
                                roomDone
                                  ? "bg-moss"
                                  : room.kind === "boss"
                                    ? "bg-blood/50"
                                    : "bg-ridge/60"
                              }`}
                            />
                          );
                        })}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 border-2 border-ridge/50 bg-void/45 p-3">
              <p className="text-[0.72rem] leading-5 text-ash">
                Klik lantai untuk melihat denahnya. Ruang bertanda ✓ sudah selesai.
                Boss tetap tersembunyi sampai kamu mengalahkannya.
              </p>
            </div>

            <Link
              href={href}
              className="pixel-button mt-4 w-full border-gold bg-gold text-void hover:bg-bone"
            >
              {hasActiveRun ? "Lanjutkan run" : "Pilih karakter"} <span aria-hidden="true">→</span>
            </Link>
          </aside>
        </div>
      </div>

      <p className="mt-3 text-center text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash/65">
        Peta ini tidak bisa diubah. Jalankan, lalu buka detail di dalam ruang.
      </p>
    </section>
  );
}

function FloorCanvas({ map }: { map: FloorMap }) {
  const ref = useCanvasRef();

  useCanvasDraw(ref, map);

  return (
    <canvas
      ref={ref}
      aria-label={`Denah lantai ${map.floorOrder}`}
      className="block h-auto w-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

function useCanvasRef() {
  return useRef<HTMLCanvasElement>(null);
}

function useCanvasDraw(
  ref: React.RefObject<HTMLCanvasElement | null>,
  map: FloorMap,
) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = 7;
    canvas.width = map.width * scale;
    canvas.height = map.height * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const code = (map.tiles[y]?.[x] ?? TileCode.VOID) as TileCode;
        if (code === TileCode.VOID) continue;
        const colour = TILE_COLOURS[code];
        if (!colour) continue;
        ctx.fillStyle = colour;
        ctx.fillRect(x * scale, y * scale, scale, scale);

        if (code === TileCode.WALL_TOP || code === TileCode.WALL_FACE) {
          ctx.fillStyle = "rgba(255,255,255,0.07)";
          ctx.fillRect(x * scale, y * scale, scale, 1);
        }
        if (code === TileCode.FLOOR || code === TileCode.FLOOR_ALT) {
          ctx.fillStyle = "rgba(0,0,0,0.2)";
          ctx.fillRect(x * scale, y * scale, scale, 1);
        }
      }
    }

    const boss = map.rooms.find((room) => room.isBoss) ?? map.rooms.at(-1);
    if (boss) {
      const { x, y, width, height } = boss.rect;
      ctx.fillStyle = "rgba(5,8,11,0.7)";
      ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
      const glow = ctx.createRadialGradient(
        (x + width / 2) * scale,
        (y + height / 2) * scale,
        4,
        (x + width / 2) * scale,
        (y + height / 2) * scale,
        width * scale * 0.7,
      );
      glow.addColorStop(0, "rgba(207,92,104,0.34)");
      glow.addColorStop(1, "rgba(207,92,104,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
    }
  }, [map, ref]);
}

function RoomBadge({
  map,
  rect,
  label,
  boss = false,
  done = false,
}: {
  map: FloorMap;
  rect: { x: number; y: number; width: number; height: number };
  label: string;
  boss?: boolean;
  done?: boolean;
}) {
  return (
    <span
      className={`pointer-events-none absolute z-10 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center border font-pixel text-[0.56rem] shadow-[2px_2px_0_#05080b] ${
        done
          ? "border-moss/70 bg-moss/20 text-moss"
          : boss
            ? "atlas-boss-pulse border-blood/70 bg-blood/20 text-blood"
            : "border-gold/50 bg-[#0a0f14]/85 text-gold"
      }`}
      style={{
        left: `${((rect.x + rect.width / 2) / map.width) * 100}%`,
        top: `${((rect.y + rect.height / 2) / map.height) * 100}%`,
      }}
    >
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r-2 border-void px-3 py-3 text-center last:border-r-0">
      <p className="font-pixel text-lg font-bold leading-none text-gold">{value}</p>
      <p className="mt-2 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-ash">
        {label}
      </p>
    </div>
  );
}
