"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { playSfx, type Sfx } from "@/game/audio";

export interface MenuEntry {
  key: string;
  label: ReactNode;
  /** Shown on the right of the row (counts, prices). */
  aside?: ReactNode;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  sfx?: Sfx | "none";
}

interface GameMenuProps {
  items: MenuEntry[];
  label: string;
  autoFocus?: boolean;
  className?: string;
  /** Grid columns; 2 gives the battle command layout. */
  columns?: 1 | 2;
  /** Called when the cursor lands on a row (keyboard, hover or focus). */
  onActiveChange?: (index: number) => void;
}

/**
 * GBA list menu. Arrow keys move the ▶ cursor (with a tick sound), Enter or a
 * click picks the row. Rows are real buttons and links, so Tab and screen
 * readers work too.
 */
export default function GameMenu({
  items,
  label,
  autoFocus = true,
  className = "",
  columns = 1,
  onActiveChange,
}: GameMenuProps) {
  const [active, setActiveState] = useState(() => Math.max(0, items.findIndex((item) => !item.disabled)));
  const setActive = (index: number) => {
    setActiveState(index);
    onActiveChange?.(index);
  };
  const refs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    if (autoFocus) refs.current[active]?.focus({ preventScroll: true });
    // Only on mount: later focus follows the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = (from: number, delta: number) => {
    const count = items.length;
    for (let step = 1; step <= count; step++) {
      const next = (((from + delta * step) % count) + count) % count;
      if (!items[next]?.disabled) {
        setActive(next);
        refs.current[next]?.focus({ preventScroll: true });
        playSfx("uiMove");
        return;
      }
    }
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const vertical = columns === 2 ? 2 : 1;
    const keys: Record<string, number> = {
      ArrowDown: vertical,
      ArrowUp: -vertical,
      ...(columns === 2 ? { ArrowRight: 1, ArrowLeft: -1 } : {}),
    };
    const delta = keys[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    move(index, delta);
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={`ui-menu ${columns === 2 ? "grid-cols-2" : ""} ${className}`}
    >
      {items.map((item, index) => {
        const common = {
          ref: (element: HTMLElement | null) => {
            refs.current[index] = element;
          },
          className: "ui-menu-item",
          "data-active": index === active,
          "data-sfx": item.sfx ?? "uiAccept",
          onFocus: () => setActive(index),
          onMouseEnter: () => {
            if (!item.disabled) setActive(index);
          },
          onKeyDown: (event: React.KeyboardEvent) => onKeyDown(event, index),
        };
        const body = (
          <>
            <span className="min-w-0 flex-1">{item.label}</span>
            {item.aside !== undefined ? <span className="shrink-0">{item.aside}</span> : null}
          </>
        );
        if (item.href && !item.disabled) {
          return (
            <Link key={item.key} href={item.href} {...common}>
              {body}
            </Link>
          );
        }
        return (
          <button
            key={item.key}
            type="button"
            disabled={item.disabled}
            onClick={item.onSelect}
            {...common}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
