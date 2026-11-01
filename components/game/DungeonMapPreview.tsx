"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { PixelSprite } from "@/components/brand/PixelSprite";
import { generateFloorFromPlan } from "@/game/map/generateFloor";
import { TileCode } from "@/game/map/tiles";
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
  [TileCode.WALL_TOP]: "#24313f",
  [TileCode.WALL_FACE]: "#35485c",
  [TileCode.FLOOR]: "#192431",
  [TileCode.FLOOR_ALT]: "#223143",
  [TileCode.DOOR_LOCKED]: "#d9713f",
  [TileCode.DOOR_OPEN]: "#8fbd72",
  [TileCode.STAIRS]: "#e9b85d",
  [TileCode.WALL_DECOR]: "#8fbd72",
  [TileCode.BANNER_RED]: "#cf5c68",
  [TileCode.PROP]: "#6b4a2d",
};

const SCALE = 6;

interface DungeonMapPreviewProps {
  title: string;
  tier: DungeonTier;
  floors: readonly FloorPlan[];
  findingCount: number;
  citationCount: number;
  href: string;
}

export default function DungeonMapPreview({
  title,
  tier,
  floors,
  findingCount,
  citationCount,
  href,
}: DungeonMapPreviewProps) {
  const totalRooms = floors.reduce((sum, floor) => sum + floor.rooms.length, 0);
  const totalMonsters = floors.reduce((sum, floor) => sum + floor.monsterCount, 0);

  return (
    <section className="game-screen-in">
      <div className="pixel-panel pixel-panel-gold overflow-hidden">
        <div className="relative overflow-hidden border-b-2 border-void p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(233,184,93,0.12),transparent_55%)]" aria-hidden="true" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">Peta ekspedisi</p>
              <h1 className="mt-2 truncate text-2xl font-bold tracking-tight text-bone sm:text-3xl">
                {title}
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-6 text-ash">
                Denah sudah terbentuk. Detail musuh terbuka saat kamu memasukinya.
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

        <ol className="space-y-3 p-4 sm:p-5">
          {floors.map((floor, index) => (
            <FloorCard key={floor.floorOrder} floor={floor} index={index} />
          ))}
        </ol>

        <div className="border-t-2 border-void p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-[0.74rem] leading-5 text-ash">
              {findingCount} temuan sudah jadi ruang. Klaim dan kutipan tidak ditampilkan
              di sini; hadapi dulu, baru lihat isinya.
            </p>
            <Link
              href={href}
              className="pixel-button border-gold bg-gold text-void hover:bg-bone"
            >
              Pilih karakter <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash/65">
        Peta ini tidak bisa diubah. Jalankan, lalu buka detail di dalam ruang.
      </p>
    </section>
  );
}

function FloorCard({ floor, index }: { floor: FloorPlan; index: number }) {
  const floorMap = useMemo(
    () => generateFloorFromPlan(floor, 20261101 + index),
    [floor, index],
  );
  const bossRoom = floorMap.rooms.find((room) => room.isBoss) ?? floorMap.rooms.at(-1);
  const minionRooms = floorMap.rooms.filter((room) => room.id !== bossRoom?.id);

  return (
    <li className="overflow-hidden border-2 border-ridge/70 bg-[#0b121a] shadow-[3px_3px_0_#05080b]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-void bg-tomb/80 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center border border-gold/60 bg-gold/10 font-pixel text-[0.52rem] text-gold">
            {String(floor.floorOrder).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <p className="truncate font-pixel text-[0.56rem] text-bone">
              {FLOOR_CODENAMES[floor.dimension]}
            </p>
            <p className="text-[0.52rem] font-bold uppercase tracking-[0.08em] text-ash/70">
              Lantai {floor.floorOrder} · {floor.rooms.length} ruang · {floor.monsterCount} musuh
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 border border-ridge/60 bg-void/60 px-2 py-1 text-[0.52rem] font-bold uppercase tracking-[0.08em] text-ash">
          <span className="h-1.5 w-1.5 bg-gold" aria-hidden="true" />
          Belum dijelajahi
        </span>
      </div>

      <div className="relative bg-[#05080b] p-2 sm:p-3">
        <span className="torch-flame absolute left-2 top-2 z-10" aria-hidden="true" />
        <span className="torch-flame absolute right-2 top-2 z-10" aria-hidden="true" />

        <div className="relative overflow-hidden border-2 border-void bg-[#070b10]">
          <FloorCanvas map={floorMap} />
          <div
            className="pointer-events-none absolute inset-0 shadow-[inset_0_0_34px_rgba(0,0,0,0.85),inset_0_0_0_1px_rgba(233,184,93,0.12)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0,transparent_3px,rgba(0,0,0,0.18)_3px,rgba(0,0,0,0.18)_4px)] opacity-60"
            aria-hidden="true"
          />

          {minionRooms.map((room) => (
            <RoomBadge
              key={room.id}
              map={floorMap}
              rect={room.rect}
              label={String(room.monsterSpawns?.length || room.findingIds?.length || 1)}
              title={`${room.monsterSpawns?.length ?? 1} musuh`}
            />
          ))}

          {bossRoom ? (
            <>
              <BossFog map={floorMap} rect={bossRoom.rect} />
              <RoomBadge map={floorMap} rect={bossRoom.rect} label="?" boss />
            </>
          ) : null}

          {index === 0 ? (
            <span
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${((floorMap.playerSpawn.x + 0.5) / floorMap.width) * 100}%`,
                top: `${((floorMap.playerSpawn.y + 0.5) / floorMap.height) * 100}%`,
              }}
            >
              <PixelSprite kind="hero" size={22} className="drop-shadow-[0_2px_0_#000]" />
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-void bg-[#0a0f14]/80 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[0.56rem] font-bold uppercase tracking-[0.08em] text-ash/70">
          <span className="h-1.5 w-1.5 bg-blood" aria-hidden="true" />
          Boss tersembunyi
        </span>
        <span className="flex items-center gap-2">
          <span className="font-pixel text-[0.48rem] text-ash/50">???</span>
          <PixelSprite kind="sir" size={26} className="opacity-25 grayscale" />
        </span>
      </div>
    </li>
  );
}

function FloorCanvas({ map }: { map: FloorMap }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = map.width * SCALE;
    canvas.height = map.height * SCALE;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const code = (map.tiles[y]?.[x] ?? TileCode.VOID) as TileCode;
        if (code === TileCode.VOID) continue;
        const colour = TILE_COLOURS[code];
        if (!colour) continue;
        ctx.fillStyle = colour;
        ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);

        if (code === TileCode.WALL_TOP || code === TileCode.WALL_FACE) {
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          ctx.fillRect(x * SCALE, y * SCALE, SCALE, 1);
        }
        if (code === TileCode.FLOOR || code === TileCode.FLOOR_ALT) {
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          ctx.fillRect(x * SCALE, y * SCALE, SCALE, 1);
        }
      }
    }

    const boss = map.rooms.find((room) => room.isBoss) ?? map.rooms.at(-1);
    if (boss) {
      const { x, y, width, height } = boss.rect;
      ctx.fillStyle = "rgba(5,8,11,0.82)";
      ctx.fillRect(x * SCALE, y * SCALE, width * SCALE, height * SCALE);
      const glow = ctx.createRadialGradient(
        (x + width / 2) * SCALE,
        (y + height / 2) * SCALE,
        4,
        (x + width / 2) * SCALE,
        (y + height / 2) * SCALE,
        width * SCALE * 0.6,
      );
      glow.addColorStop(0, "rgba(207,92,104,0.28)");
      glow.addColorStop(1, "rgba(207,92,104,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x * SCALE, y * SCALE, width * SCALE, height * SCALE);
    }
  }, [map]);

  return (
    <canvas
      ref={ref}
      aria-label={`Denah lantai ${map.floorOrder}`}
      className="block h-auto w-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

function RoomBadge({
  map,
  rect,
  label,
  title,
  boss = false,
}: {
  map: FloorMap;
  rect: { x: number; y: number; width: number; height: number };
  label: string;
  title?: string;
  boss?: boolean;
}) {
  return (
    <span
      className={`pointer-events-none absolute z-10 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center border font-pixel text-[0.5rem] shadow-[2px_2px_0_#05080b] ${
        boss
          ? "border-blood/70 bg-blood/20 text-blood"
          : "border-gold/50 bg-[#0a0f14]/85 text-gold"
      }`}
      style={{
        left: `${((rect.x + rect.width / 2) / map.width) * 100}%`,
        top: `${((rect.y + rect.height / 2) / map.height) * 100}%`,
      }}
      title={title}
    >
      {label}
    </span>
  );
}

function BossFog({
  map,
  rect,
}: {
  map: FloorMap;
  rect: { x: number; y: number; width: number; height: number };
}) {
  return (
    <span
      className="pointer-events-none absolute z-[5] border border-blood/40 bg-[#05080b]/80"
      style={{
        left: `${(rect.x / map.width) * 100}%`,
        top: `${(rect.y / map.height) * 100}%`,
        width: `${(rect.width / map.width) * 100}%`,
        height: `${(rect.height / map.height) * 100}%`,
        boxShadow: "inset 0 0 18px rgba(207,92,104,0.22)",
      }}
      aria-hidden="true"
    />
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
