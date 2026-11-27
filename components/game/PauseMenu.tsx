"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCharacter } from "@/lib/loadout";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { Loadout } from "@/lib/loadout";
import { getShakeMode, setShakeMode, type ShakeMode } from "@/game/feel";
import GameMenu, { type MenuEntry } from "@/components/ui/GameMenu";
import { CharacterSprite } from "@/components/ui/SheetSprite";

interface PauseMenuProps {
  dungeonTitle: string;
  floorLabel: string;
  points: number;
  hearts: number;
  heartsMax: number;
  hp?: number;
  hpMax?: number;
  loadout: Loadout;
  playerName?: string;
  findingsHref?: string;
  onResume: () => void;
  onOpenSettings?: () => void;
  onOpenShop?: () => void;
  /** The page's fullscreen toggle (it also locks landscape on phones). */
  onToggleFullscreen?: () => void;
}

const SHAKE_LABEL: Record<ShakeMode, string> = { off: "Mati", soft: "Halus", full: "Penuh" };
const SHAKE_NEXT: Record<ShakeMode, ShakeMode> = { off: "soft", soft: "full", full: "off" };

function toggleFullscreen() {
  if (typeof document === "undefined") return;
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => {});
    return;
  }
  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };
  const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
  void request?.().catch(() => {});
}

/** START menu: a list on the right, who you are on the left. Esc closes. */
export default function PauseMenu({
  dungeonTitle,
  floorLabel,
  points,
  hearts,
  heartsMax,
  hp,
  hpMax,
  loadout,
  playerName,
  findingsHref,
  onResume,
  onOpenSettings,
  onOpenShop,
  onToggleFullscreen,
}: PauseMenuProps) {
  const router = useRouter();
  const dialogRef = useFocusTrap<HTMLDivElement>();
  const character = getCharacter(loadout.characterSlug);
  const [shake, setShake] = useState<ShakeMode>(() => getShakeMode());

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onResume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onResume]);

  const items: MenuEntry[] = [
    { key: "resume", label: "Lanjutkan", sfx: "uiCancel", onSelect: onResume },
    ...(onOpenShop ? [{ key: "shop", label: "Toko", aside: `${points} koin`, onSelect: onOpenShop }] : []),
    ...(findingsHref ? [{ key: "findings", label: "Temuan", href: findingsHref }] : []),
    { key: "screen", label: "Layar penuh", onSelect: onToggleFullscreen ?? toggleFullscreen },
    {
      key: "shake",
      label: "Guncangan",
      aside: SHAKE_LABEL[shake],
      onSelect: () => {
        const next = SHAKE_NEXT[shake];
        setShakeMode(next);
        setShake(next);
      },
    },
    ...(onOpenSettings ? [{ key: "settings", label: "Kontrol", onSelect: onOpenSettings }] : []),
    { key: "camp", label: "Ke menu", sfx: "uiCancel", onSelect: () => router.push("/dashboard") },
  ];

  return (
    <div
      ref={dialogRef}
      className="font-game fixed inset-0 z-[60] flex items-start justify-between gap-3 bg-[#05080b]/55 p-3 pt-16"
      role="dialog"
      aria-modal="true"
      aria-label="Jeda"
      onClick={(event) => {
        if (event.target === event.currentTarget) onResume();
      }}
    >
      <section className="ui-box flex max-w-[22rem] items-center gap-3" aria-label="Pemain">
        <div className="ui-slot h-16 w-16 shrink-0" aria-hidden="true">
          <CharacterSprite slug={loadout.characterSlug} facing="down" scale={3} />
        </div>
        <div className="min-w-0">
          <p className="g-1 truncate">{playerName ?? character?.name ?? "Pemain"}</p>
          <p className="g-1 text-[var(--ui-rust)]">
            HP {hp ?? hearts * 100}/{hpMax ?? heartsMax * 100} · {points} koin
          </p>
          <p className="g-1 truncate text-[var(--ui-rust)]" title={dungeonTitle}>
            {floorLabel}
          </p>
        </div>
      </section>

      <nav className="ui-box w-[min(16rem,48vw)]" aria-label="Menu jeda">
        <GameMenu label="Menu jeda" items={items} />
      </nav>
    </div>
  );
}
