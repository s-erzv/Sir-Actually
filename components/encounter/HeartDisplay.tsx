"use client";

import { HEARTS_START } from "@/lib/balance";

interface HeartDisplayProps {
  hearts: number;
  heartsMax?: number;
}

export default function HeartDisplay({ hearts, heartsMax = HEARTS_START }: HeartDisplayProps) {
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`${hearts} dari ${heartsMax} Heart tersisa`}
    >
      {Array.from({ length: heartsMax }, (_, i) => (
        <span key={i} className={i < hearts ? "text-blood" : "text-ash/35"} aria-hidden="true">
          <Heart />
        </span>
      ))}
      <span className="ml-1 text-[0.72rem] uppercase tracking-[0.12em] text-ash">
        {hearts}/{heartsMax}
      </span>
    </div>
  );
}

function Heart() {
  return (
    <svg width="13" height="11" viewBox="0 0 14 12" aria-hidden="true" className="dungeon-map">
      <path
        d="M1 3 h3 v2 h2 V3 h2 v2 h3 V1 h-2 v1 H9 V1 H5 v1 H4 V1 H1 Z M1 5 v3 h2 v2 h2 v1 h4 v-1 h2 V8 h2 V5 h-3 v2 H11 V5 Z"
        fill="currentColor"
      />
    </svg>
  );
}
