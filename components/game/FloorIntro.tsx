"use client";

import { useEffect, useRef } from "react";
import type { SpriteKind } from "@/components/brand/PixelSprite";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { MonsterSprite } from "@/components/ui/SheetSprite";

interface FloorIntroProps {
  floorOrder: number;
  floorTotal: number;
  floorName: string;
  bossName: string;
  bossSprite: SpriteKind;
  bossSlug?: string;
  theme?: string;
  lore?: string;
  roomCount: number;
  monsterCount: number;
  onEnter: () => void;
}

export default function FloorIntro({
  floorOrder,
  floorTotal,
  floorName,
  bossName,
  bossSlug,
  theme,
  lore,
  roomCount,
  monsterCount,
  onEnter,
}: FloorIntroProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>();

  useEffect(() => {
    buttonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onEnter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnter]);

  const shortBoss = bossName.split(" — ")[0] ?? bossName;

  return (
    <div
      ref={dialogRef}
      className="font-game fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-[#05080b]/92 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Lantai ${floorOrder}: ${floorName}`}
    >
      <p className="g-1 text-[var(--ui-orange)]">
        Lantai {floorOrder}/{floorTotal}
      </p>
      {bossSlug ? (
        <div className="battle-foe-intro" aria-hidden="true">
          <MonsterSprite slug={bossSlug} height={200} />
        </div>
      ) : null}
      <section className="ui-box w-full max-w-[30rem]">
        <h2 className="g-2">{floorName}</h2>
        <p className="g-1 text-[var(--ui-rust)]">
          Penjaga: {shortBoss} · {monsterCount} monster · {roomCount} ruang
        </p>
        {lore || theme ? <p className="g-1 mt-1 line-clamp-3">{lore ?? theme}</p> : null}
      </section>
      <button ref={buttonRef} type="button" onClick={onEnter} className="ui-btn min-w-[12rem]">
        Masuk
      </button>
    </div>
  );
}
