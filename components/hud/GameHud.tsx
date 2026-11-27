"use client";

import { useEffect, useState } from "react";
import { bus } from "@/game/bus";
import { HEART_HP, HEARTS_START, POTION_BAG_MAX } from "@/lib/balance";
import type { FloorMap } from "@/lib/domain/types";
import { getItem } from "@/lib/combat/items";
import { ShieldBar } from "@/components/encounter/BattleScene";

interface GameHudProps {
  floorMap: FloorMap;
  hearts: number;
  heartsMax?: number;
  points?: number;
  /** Total player HP; when present, the bar shows it instead of whole Hearts. */
  hp?: number;
  hpMax?: number;
  potions?: number;
  potionBusy?: boolean;
  onUsePotion?: () => void;
  armor?: { slug: string; name: string; shield: number; shieldMax: number } | null;
  weapon?: { slug: string; name: string; power: number } | null;
}

function hpLevel(ratio: number): "high" | "mid" | "low" {
  if (ratio > 0.5) return "high";
  if (ratio > 0.2) return "mid";
  return "low";
}

/** One box, top-left: floor and room, HP, Hearts, coins, and the potion. */
export default function GameHud({
  floorMap,
  hearts,
  heartsMax = HEARTS_START,
  points = 0,
  hp,
  hpMax,
  potions = 0,
  potionBusy = false,
  onUsePotion,
  armor = null,
  weapon = null,
}: GameHudProps) {
  const [roomCurrent, setRoomCurrent] = useState(0);

  useEffect(() => {
    const onEncounterStart = (evt: { room: number }) => {
      // Dwellers use room numbers above the real rooms; they are corridors.
      if (evt.room < floorMap.rooms.length) setRoomCurrent(evt.room);
    };
    const onFloorRetry = () => setRoomCurrent(0);
    bus.on("encounter:start", onEncounterStart);
    bus.on("floor:retry", onFloorRetry);
    return () => {
      bus.off("encounter:start", onEncounterStart);
      bus.off("floor:retry", onFloorRetry);
    };
  }, [floorMap.rooms.length]);

  useEffect(() => {
    setRoomCurrent(0);
  }, [floorMap]);

  const max = hpMax ?? heartsMax * HEART_HP;
  const current = hp ?? hearts * HEART_HP;
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const canDrink = Boolean(onUsePotion) && potions > 0 && !potionBusy;

  return (
    <div className="ui-chip font-game absolute left-2 top-2 z-10 w-[min(15.5rem,46vw)]" aria-label="Status">
      <div className="g-1 flex items-center justify-between gap-2">
        <span>Lantai {floorMap.floorOrder}</span>
        <span className="text-[var(--ui-rust)]">
          Ruang {Math.min(roomCurrent + 1, floorMap.rooms.length || 1)}/{floorMap.rooms.length || 1}
        </span>
      </div>

      <div
        className="ui-hp mt-0.5"
        role="meter"
        aria-label="HP"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.max(0, Math.round(current))}
      >
        <span className="ui-hp-tag">HP</span>
        <span className="ui-hp-track">
          <span className="ui-hp-fill block" data-level={hpLevel(ratio)} style={{ width: `${ratio * 100}%` }} />
        </span>
      </div>

      {armor ? <ShieldBar value={armor.shield} max={armor.shieldMax} /> : null}

      <div className="g-1 mt-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1">
          <EquipSlot label={weapon ? `${weapon.name} +${weapon.power}` : "Tanpa senjata"} icon={weapon ? getItem(weapon.slug)?.icon : undefined} />
          <EquipSlot label={armor ? `${armor.name} ${armor.shield}/${armor.shieldMax}` : "Tanpa armor"} icon={armor ? getItem(armor.slug)?.icon : undefined} />
        </span>
        <span key={points} className="points-pop flex items-center gap-1" aria-label={`${points} koin`}>
          <img src="/assets/ninja-adventure/items/coin-gold.png" alt="" width={14} height={14} className="ui-icon" />
          {points}
        </span>
      </div>

      <button
        type="button"
        onClick={onUsePotion}
        disabled={!canDrink}
        data-sfx="none"
        className="ui-menu-item mt-0.5 !min-h-[36px] !pl-1 disabled:opacity-50"
        aria-label={`Minum ramuan, sisa ${potions}`}
        title="Minum ramuan (Q)"
      >
        <img src="/assets/ninja-adventure/items/potion-life.png" alt="" width={18} height={22} className="ui-icon" />
        <span>{potionBusy ? "..." : `x${potions}/${POTION_BAG_MAX}`}</span>
        <span className="ml-auto text-[var(--ui-rust)]">Q</span>
      </button>
    </div>
  );
}

/** Small slot showing what is equipped; empty slots stay as a dim frame. */
function EquipSlot({ label, icon }: { label: string; icon?: string }) {
  return (
    <span className="ui-slot h-7 w-7" title={label} aria-label={label} role="img">
      {icon ? <img src={icon} alt="" width={18} height={18} className="ui-icon h-[18px] w-[18px] object-contain" /> : null}
    </span>
  );
}
