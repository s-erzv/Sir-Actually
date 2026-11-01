"use client";

interface HpBarProps {
  hp: number;
  hpMax: number;
}

export default function HpBar({ hp, hpMax }: HpBarProps) {
  const pct = hpMax > 0 ? Math.max(0, Math.min(100, (hp / hpMax) * 100)) : 0;

  const color =
    pct > 50 ? "#8fbd72" // moss
    : pct > 25 ? "#e9b85d" // gold
    : "#cf5c68"; // blood

  return (
    <div className="flex items-center gap-2">
      <span className="w-6 shrink-0 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-ash">
        HP
      </span>
      <div
        className="h-3 flex-1 border-2 border-void bg-void shadow-[inset_0_0_0_1px_#34424e]"
        role="progressbar"
        aria-valuenow={hp}
        aria-valuemin={0}
        aria-valuemax={hpMax}
      >
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}66` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-[0.72rem] tabular-nums text-ash">
        {hp}/{hpMax}
      </span>
    </div>
  );
}
