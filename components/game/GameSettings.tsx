"use client";

import { useEffect } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { GameSettings } from "@/lib/gameSettings";

interface GameSettingsModalProps {
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
  onClose: () => void;
}

export default function GameSettingsModal({ settings, onChange, onClose }: GameSettingsModalProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      className="game-fade fixed inset-0 z-[70] grid place-items-center bg-[#05080b]/90 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Pengaturan tampilan game"
    >
      <div className="game-screen-in w-full max-w-sm border-2 border-ridge bg-[#0a0f14] shadow-[8px_8px_0_#05080b]">
        <div className="flex items-center justify-between border-b-2 border-void bg-tomb px-4 py-2">
          <span className="font-pixel text-[0.56rem] text-gold">PENGATURAN</span>
          <button
            type="button"
            onClick={onClose}
            className="border border-ridge/60 px-2 py-0.5 font-pixel text-[0.48rem] uppercase text-ash hover:border-gold hover:text-gold"
          >
            Tutup
          </button>
        </div>

        <div className="p-4">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-ash">
            Skema kontrol sentuh
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                { value: "dpad", label: "Panah", note: "Tombol arah 4 arah" },
                { value: "stick", label: "Stik", note: "Joystick geser" },
              ] as const
            ).map((option) => {
              const active = settings.controls === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ ...settings, controls: option.value })}
                  className={`border-2 px-3 py-2 text-left ${
                    active
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-ridge/60 bg-void/50 text-ash hover:border-gold/60"
                  }`}
                >
                  <span className="block font-pixel text-[0.56rem] uppercase tracking-[0.08em]">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-[0.62rem] leading-4">{option.note}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t-2 border-void pt-3">
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-ash">
                Peta mini
              </p>
              <p className="mt-0.5 text-[0.62rem] text-ash/80">Tampilkan peta di sudut layar.</p>
            </div>
            <button
              type="button"
              aria-pressed={settings.showMinimap}
              onClick={() => onChange({ ...settings, showMinimap: !settings.showMinimap })}
              className={`border-2 px-3 py-1 font-pixel text-[0.5rem] uppercase tracking-[0.08em] ${
                settings.showMinimap
                  ? "border-moss bg-moss/15 text-moss"
                  : "border-ridge/60 bg-void/50 text-ash"
              }`}
            >
              {settings.showMinimap ? "Tampil" : "Sembunyi"}
            </button>
          </div>

          <p className="mt-4 border-t-2 border-void pt-3 text-[0.62rem] leading-5 text-ash/80">
            Guncangan layar dan layar penuh ada di menu jeda. Zoom pakai tombol − / + di layar
            atau cubit dua jari.
          </p>
        </div>
      </div>
    </div>
  );
}
