"use client";

import { useEffect, useRef, useState } from "react";
import {
  getAudioSettings,
  playSfx,
  preloadSfx,
  setMusicVolume,
  setMuted,
  setSfxVolume,
  subscribeAudio,
  type AudioSettings,
  type Sfx,
} from "@/game/audio";

const CLICKABLE = 'button, a[href], [role="button"], [role="menuitem"], summary, input[type="checkbox"], input[type="radio"], select';

/** Pixel speaker on a 9x9 grid; a cross replaces the waves when muted. */
function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 9 9" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="currentColor" d="M0 3h2v3H0zM2 2h1v5H2zM3 1h1v7H3z" />
      {muted ? (
        <path fill="currentColor" d="M5 3h1v1H5zM7 3h1v1H7zM6 4h1v1H6zM5 5h1v1H5zM7 5h1v1H7z" />
      ) : (
        <path fill="currentColor" d="M5 3h1v3H5zM7 2h1v1H7zM8 3h1v3H8zM7 6h1v1H7z" />
      )}
    </svg>
  );
}

/**
 * Corner volume control on every screen, plus the click sound for every
 * button and link. An element opts out with data-sfx="none" or picks another
 * sound with data-sfx="uiCancel" (any Sfx name).
 */
export default function SoundDock() {
  const [audio, setAudio] = useState<AudioSettings>({ music: 0.6, sfx: 0.8, muted: false });
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setAudio(getAudioSettings());
    return subscribeAudio(setAudio);
  }, []);

  useEffect(() => {
    let preloaded = false;
    const onPointer = () => {
      if (preloaded) return;
      preloaded = true;
      preloadSfx();
    };
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest?.(CLICKABLE) as HTMLElement | null;
      if (!target) return;
      if ((target as HTMLButtonElement).disabled || target.getAttribute("aria-disabled") === "true") return;
      const choice = target.dataset.sfx;
      if (choice === "none") return;
      playSfx((choice as Sfx | undefined) ?? "uiAccept");
    };
    window.addEventListener("pointerdown", onPointer, { passive: true });
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const silent = audio.muted || (audio.music === 0 && audio.sfx === 0);

  return (
    <div
      className="fixed z-[95]"
      style={{
        top: "max(0.5rem, env(safe-area-inset-top))",
        right: "max(0.5rem, env(safe-area-inset-right))",
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        data-sfx={open ? "uiCancel" : "uiOpen"}
        className="ui-icon-btn"
        aria-label="Atur suara"
        aria-expanded={open}
        aria-controls="sound-dock-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <SpeakerIcon muted={silent} />
      </button>

      {open ? (
        <div
          ref={panelRef}
          id="sound-dock-panel"
          role="dialog"
          aria-label="Suara"
          className="ui-box font-game absolute right-0 top-[52px] w-[min(18rem,calc(100vw-1rem))]"
        >
          <VolumeRow label="Musik" value={audio.music} disabled={audio.muted} onChange={setMusicVolume} />
          <VolumeRow
            label="Efek"
            value={audio.sfx}
            disabled={audio.muted}
            onChange={setSfxVolume}
            onCommit={() => playSfx("uiMove")}
          />
          <button
            type="button"
            className="ui-btn is-quiet mt-1 w-full"
            data-sfx="none"
            aria-pressed={audio.muted}
            onClick={() => {
              setMuted(!audio.muted);
              if (audio.muted) playSfx("uiAccept");
            }}
          >
            {audio.muted ? "Nyalakan suara" : "Bisukan"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function VolumeRow({
  label,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onCommit?: () => void;
}) {
  const percent = Math.round(value * 100);
  return (
    <label className="block">
      <span className="g-1 flex items-center justify-between">
        <span>{label}</span>
        <span aria-hidden="true">{percent}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        disabled={disabled}
        aria-valuetext={`${percent} persen`}
        className="ui-range disabled:opacity-40"
        style={{ ["--fill" as string]: `${percent}%` }}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
    </label>
  );
}
