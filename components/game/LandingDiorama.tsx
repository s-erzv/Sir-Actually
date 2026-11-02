import type { CSSProperties } from "react";
import {
  FRAME_BANNER_RED,
  FRAME_DOOR_LOCKED,
  FRAME_FLOOR,
  FRAME_MINION,
  FRAME_PLAYER,
  FRAME_PROP,
  FRAME_STAIRS,
  FRAME_WALL_DECOR,
  FRAME_WALL_FACE,
} from "@/game/map/tileFrames";

const COLS = 21;
const ROWS = 9;
const TILE = 32;

const SHEET_COLS = 12;
const SHEET_TILE = 16;
const SHEET_STEP = 17;
const SHEET_W = 203;
const SHEET_H = 186;

const WALL_DECOR_COLS = [3, 7, 11, 15];
const BANNER_COLS = [17, 18, 19];
const PROPS: Array<[number, number, number]> = [
  [1, 2, 82],
  [19, 2, 89],
  [1, 8, 63],
  [19, 8, 82],
];

function frameStyle(frame: number, size = TILE): CSSProperties {
  const k = size / SHEET_TILE;
  const col = frame % SHEET_COLS;
  const row = Math.floor(frame / SHEET_COLS);
  return {
    width: size,
    height: size,
    backgroundImage: "url('/assets/tiny-dungeon/Tilemap/tilemap.png')",
    backgroundSize: `${SHEET_W * k}px ${SHEET_H * k}px`,
    backgroundPosition: `-${col * SHEET_STEP * k}px -${row * SHEET_STEP * k}px`,
    imageRendering: "pixelated",
  };
}

function frameFor(x: number, y: number): number {
  const prop = PROPS.find(([px, py]) => px === x && py === y);
  if (prop) return prop[2];

  if (y === 0) return FRAME_WALL_FACE;
  if (y === 1) {
    if (x === 0 || x === COLS - 1) return FRAME_WALL_FACE;
    if (x === 10) return FRAME_DOOR_LOCKED;
    if (BANNER_COLS.includes(x)) return FRAME_BANNER_RED;
    if (WALL_DECOR_COLS.includes(x)) return FRAME_WALL_DECOR[x % FRAME_WALL_DECOR.length]!;
    return FRAME_WALL_FACE;
  }
  if (x === 0 || x === COLS - 1) return FRAME_WALL_FACE;
  if (x === 18 && y === 3) return FRAME_STAIRS;
  if ((x * 7 + y * 3) % 19 === 0) return 12;
  return FRAME_FLOOR;
}

const TILES = Array.from({ length: ROWS * COLS }, (_, i) => {
  const x = i % COLS;
  const y = Math.floor(i / COLS);
  return { key: `${x}-${y}`, frame: frameFor(x, y) };
});

function Sprite({
  frame,
  size,
  x,
  y,
  className = "",
  flip = false,
}: {
  frame: number;
  size: number;
  x: number;
  y: number;
  className?: string;
  flip?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute bg-no-repeat ${className}`}
      style={{
        ...frameStyle(frame, size),
        left: x * TILE + (TILE - size) / 2,
        top: y * TILE + (TILE - size),
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    />
  );
}

export function LandingDiorama({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative shrink-0 ${className}`}
      style={{ width: COLS * TILE, height: ROWS * TILE }}
    >
      <div
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${COLS}, ${TILE}px)` }}
      >
        {TILES.map((tile) => (
          <div key={tile.key} className="bg-no-repeat" style={frameStyle(tile.frame)} />
        ))}
      </div>

      {/* ambient light pools */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(233,184,93,0.18),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_78%_62%,rgba(207,92,104,0.2),transparent_42%)]" />

      {/* torches on the north wall */}
      {WALL_DECOR_COLS.map((x) => (
        <span
          key={`torch-${x}`}
          className="torch-flame pointer-events-none absolute"
          style={{ left: x * TILE + 12, top: TILE + 6 }}
        />
      ))}

      {/* entity: hero */}
      <Sprite frame={FRAME_PLAYER} size={44} x={4} y={6} className="animate-bob drop-shadow-[0_4px_0_rgba(0,0,0,0.65)]" />
      {/* entities: minions */}
      <Sprite frame={FRAME_MINION[0]!} size={34} x={8} y={5} className="animate-floaty drop-shadow-[0_4px_0_rgba(0,0,0,0.6)]" />
      <Sprite frame={FRAME_MINION[1]!} size={34} x={12} y={7} className="animate-floaty drop-shadow-[0_4px_0_rgba(0,0,0,0.6)]" flip />
      <Sprite frame={FRAME_MINION[2]!} size={34} x={14} y={4} className="animate-floaty drop-shadow-[0_4px_0_rgba(0,0,0,0.6)]" />
      {/* entity: floor boss */}
      <Sprite frame={112} size={62} x={18} y={6} className="animate-floaty drop-shadow-[0_6px_0_rgba(0,0,0,0.7)]" />

      {/* damage number */}
      <span className="damage-pop pointer-events-none absolute font-pixel text-base font-bold text-blood drop-shadow-[0_2px_0_#05080b]" style={{ left: 18 * TILE + 34, top: 6 * TILE - 14 }}>
        −24
      </span>

      {/* fog + vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,11,0.55),transparent_28%,transparent_72%,rgba(5,8,11,0.72))]" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_70px_rgba(0,0,0,0.85)]" />
    </div>
  );
}
