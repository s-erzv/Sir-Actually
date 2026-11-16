import { CHARACTER_FACES } from "@/lib/sprites/sheets";
import { monsterPortraitFor } from "@/lib/sprites/monsters";

interface PortraitProps {
  slug: string;
  size?: number;
  className?: string;
  title?: string;
}

/** Pixel portrait for the five playable characters. */
export function CharacterPortrait({ slug, size = 64, className = "", title }: PortraitProps) {
  const src = CHARACTER_FACES[slug];
  if (!src) return null;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={title ?? ""}
      title={title}
      draggable={false}
      className={`shrink-0 select-none ${className}`}
      style={{ imageRendering: "pixelated", width: size, height: size }}
    />
  );
}

/** Portrait for a boss or minion slug (`veylith`, `minion-varkul`, ...). */
export function MonsterPortrait({
  slug,
  isBoss,
  size = 64,
  className = "",
  title,
}: PortraitProps & { isBoss: boolean }) {
  const src = monsterPortraitFor(slug, isBoss);
  if (!src) return null;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={title ?? ""}
      title={title}
      draggable={false}
      className={`shrink-0 select-none ${className}`}
      style={{ imageRendering: "pixelated", width: size, height: size }}
    />
  );
}
