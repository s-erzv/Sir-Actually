import type { CSSProperties } from "react";
import { CHARACTER_SHEETS, FACING_COLUMN, type Facing } from "@/lib/sprites/sheets";
import { bossSheetFor, minionSheetFor } from "@/lib/sprites/monsters";
import { getBossForFloor } from "@/lib/monsters";

interface SheetSpriteProps {
  src: string;
  frameW: number;
  frameH: number;
  /** Sheet size in frames. */
  cols: number;
  rows: number;
  /** Frames to play and the direction the strip runs. */
  frames: number;
  axis: "x" | "y";
  /** Start cell of the strip. */
  col?: number;
  row?: number;
  scale: number;
  fps?: number;
  className?: string;
  style?: CSSProperties;
  label?: string;
}

/**
 * One animated cell strip from a sprite sheet, drawn at a whole-number scale.
 * Steps through frames with CSS only; reduced motion shows the first frame.
 */
export default function SheetSprite({
  src,
  frameW,
  frameH,
  cols,
  rows,
  frames,
  axis,
  col = 0,
  row = 0,
  scale,
  fps = 6,
  className = "",
  style,
  label,
}: SheetSpriteProps) {
  const x0 = -col * frameW * scale;
  const y0 = -row * frameH * scale;
  const span = frames * (axis === "x" ? frameW : frameH) * scale;
  const vars = {
    "--sx0": `${x0}px`,
    "--sy0": `${y0}px`,
    "--sx1": `${axis === "x" ? x0 - span : x0}px`,
    "--sy1": `${axis === "y" ? y0 - span : y0}px`,
  } as CSSProperties;
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`sheet-sprite ${frames > 1 ? `sheet-${axis}` : ""} ${className}`}
      style={{
        width: frameW * scale,
        height: frameH * scale,
        backgroundImage: `url("${src}")`,
        backgroundSize: `${cols * frameW * scale}px ${rows * frameH * scale}px`,
        backgroundPosition: `${x0}px ${y0}px`,
        animationDuration: `${frames / fps}s`,
        animationTimingFunction: `steps(${frames})`,
        ...vars,
        ...style,
      }}
    />
  );
}

/** A playable character walking in place, facing one way (16x16 frames). */
export function CharacterSprite({
  slug,
  facing = "down",
  scale = 4,
  walking = true,
  className,
  label,
}: {
  slug: string;
  facing?: Facing;
  scale?: number;
  walking?: boolean;
  className?: string;
  label?: string;
}) {
  const src = CHARACTER_SHEETS[slug] ?? CHARACTER_SHEETS.arka!;
  return (
    <SheetSprite
      src={src}
      frameW={16}
      frameH={16}
      cols={4}
      rows={7}
      frames={walking ? 4 : 1}
      axis="y"
      col={FACING_COLUMN[facing]}
      scale={scale}
      fps={5}
      className={className}
      label={label}
    />
  );
}

/**
 * A monster facing the player: a boss idle strip, or a minion's front walk.
 * `slug` accepts the encounter form (`veylith`, `minion-varkul`).
 */
export function MonsterSprite({
  slug,
  height,
  className,
  label,
}: {
  slug: string;
  /** Target on-screen height; the scale rounds to a whole number. */
  height: number;
  className?: string;
  label?: string;
}) {
  const lower = slug.toLowerCase();
  const floorBoss = /^boss-floor-(\d+)$/.exec(lower);
  const clean = floorBoss ? getBossForFloor(Number(floorBoss[1])).slug : lower.replace(/^minion-/, "");
  const boss = bossSheetFor(clean);
  if (boss) {
    const scale = Math.max(1, Math.round(height / boss.frameHeight));
    return (
      <SheetSprite
        src={boss.idle}
        frameW={boss.frameWidth}
        frameH={boss.frameHeight}
        cols={boss.idleFrames}
        rows={1}
        frames={boss.idleFrames}
        axis="x"
        scale={scale}
        fps={8}
        className={className}
        label={label}
      />
    );
  }
  const minion = minionSheetFor(clean) ?? minionSheetFor("varkul")!;
  const scale = Math.max(1, Math.round(height / 16));
  return (
    <SheetSprite
      src={minion.path}
      frameW={16}
      frameH={16}
      cols={4}
      rows={7}
      frames={4}
      axis="y"
      col={0}
      scale={scale}
      fps={5}
      className={className}
      label={label}
    />
  );
}
