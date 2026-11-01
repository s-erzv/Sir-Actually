import type { CSSProperties } from "react";

interface LogoMarkProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

interface LogoProps extends LogoMarkProps {
  tagline?: boolean;
}

export function LogoMark({ size = 38, className = "", style }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Sir, Actually"
      className={`dungeon-map shrink-0 ${className}`}
      style={style}
    >
      <path
        d="M5 5 H27 V15 L26 19 L23 23 L19 26 L16 29 L13 26 L9 23 L6 19 L5 15 Z"
        fill="#0b1117"
        stroke="#e9b85d"
        strokeWidth="2"
      />
      <path
        d="M8 8 H24 V15 L23 18 L20 21 L16 24 L12 21 L9 18 L8 15 Z"
        fill="none"
        stroke="#34424e"
        strokeWidth="1"
      />
      <path d="M18 4 H23 V6 H26 V9 H24 V7 H22 V9 H20 V7 H18 Z" fill="#cf5c68" />
      <path d="M12 8 H20 V10 H22 V16 H20 V20 H12 V16 H10 V10 H12 Z" fill="#f0e7d5" />
      <path d="M11 11 H21 V14 H11 Z" fill="#080b10" />
      <path d="M13 12 H15 V14 H13 Z M17 12 H19 V14 H17 Z" fill="#e9b85d" />
      <path d="M15 14 H17 V19 H15 Z" fill="#e9b85d" />
      <path d="M12 16 H15 V20 H12 Z M17 16 H20 V20 H17 Z M14 20 H18 V22 H14 Z" fill="#f0e7d5" />
      <path d="M12 21 H20 V23 H12 Z" fill="#cbbfa8" />
      <path d="M7 9 H8 V11 H7 Z M24 9 H25 V11 H24 Z" fill="#e9b85d" />
    </svg>
  );
}

export function Logo({ size = 38, tagline = false, className = "", style }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} style={style}>
      <LogoMark size={size} />
      <span className="flex min-w-0 flex-col">
        <span className="font-pixel text-[11px] font-bold uppercase leading-[1.3] tracking-[0.04em] text-bone sm:text-[12px]">
          Sir, Actually
        </span>
        {tagline ? (
          <span className="mt-1 font-pixel text-[7px] uppercase leading-none tracking-[0.04em] text-ash">
            Research boss battle
          </span>
        ) : null}
      </span>
    </span>
  );
}
