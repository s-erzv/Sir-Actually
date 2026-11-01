"use client";

import { useEffect, useMemo, useState } from "react";
import { PixelSprite } from "@/components/brand/PixelSprite";

const PHASES = [
  {
    at: 0,
    label: "Membaca naskah",
    detail: "Memecah heading, paragraf, dan daftar rujukan.",
  },
  {
    at: 3,
    label: "Memetakan klaim",
    detail: "AI memisahkan masalah, tujuan, metode, hasil, dan kesimpulan.",
  },
  {
    at: 7,
    label: "Memeriksa rujukan",
    detail: "Menyusun daftar pustaka dan kutipan yang bisa dilacak.",
  },
  {
    at: 13,
    label: "Menempa Research Map",
    detail: "Menyiapkan peta yang langsung dikunci jadi dungeon.",
  },
] as const;

const TIPS = [
  "Kutipan harus persis ada di naskah. Bukan parafrase.",
  "File asli tidak diunggah. Teks diekstrak di browser.",
  "Setiap temuan nanti jadi monster. Setiap klaim diuji.",
  "Naskah 40 ribu karakter biasanya butuh 10–30 detik.",
];

interface ReadingOverlayProps {
  fileName?: string | null;
}

export default function ReadingOverlay({ fileName }: ReadingOverlayProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed((Date.now() - started) / 1000);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  const phaseIndex = useMemo(() => {
    let index = 0;
    for (let i = 0; i < PHASES.length; i += 1) {
      if (elapsed >= PHASES[i]!.at) index = i;
    }
    return index;
  }, [elapsed]);

  const phase = PHASES[phaseIndex]!;
  const progress = Math.min(92, Math.round(10 + elapsed * 4.2));
  const tip = TIPS[Math.floor(elapsed / 4) % TIPS.length];

  return (
    <div
      className="game-fade fixed inset-0 z-50 grid place-items-center bg-[#05080b]/92 px-4 py-6 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-busy="true"
      aria-label="AI membaca naskah"
    >
      <div className="game-screen-in w-full max-w-lg border-2 border-gold bg-[#0a0f14] shadow-[8px_8px_0_#05080b,0_0_70px_rgba(233,184,93,0.12)]">
        <div className="flex items-center justify-between gap-3 border-b-2 border-void bg-tomb px-3 py-2">
          <span className="font-pixel text-[0.54rem] text-gold">FORGE · AI MEMBACA NASKAH</span>
          <span className="flex items-center gap-1.5 text-[0.58rem] font-bold uppercase tracking-[0.08em] text-ember">
            <span className="h-2 w-2 animate-flicker bg-ember" aria-hidden="true" />
            {Math.floor(elapsed)}s
          </span>
        </div>

        <div className="tile-floor relative h-48 overflow-hidden border-b-2 border-void">
          <div className="wall-stone absolute inset-x-0 top-0 h-7 border-b-2 border-void" />
          <div className="wall-stone absolute inset-x-0 bottom-0 h-6 border-t-2 border-void" />
          <span className="torch-flame absolute left-7 top-10" />
          <span className="torch-flame absolute right-7 top-10" />

          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-gold/10 via-transparent to-transparent" />
          <div className="forge-scan pointer-events-none absolute inset-y-6 w-16 bg-[linear-gradient(90deg,transparent,rgba(233,184,93,0.22),transparent)]" aria-hidden="true" />

          <PixelSprite
            kind="hero"
            size={72}
            className="absolute bottom-5 left-[14%] drop-shadow-[0_5px_0_rgba(0,0,0,0.5)]"
          />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
            <div className="forge-scroll relative">
              <PixelSprite kind="scroll" size={70} className="drop-shadow-[0_5px_0_rgba(0,0,0,0.5)]" />
              <span className="forge-spark forge-spark-a" aria-hidden="true" />
              <span className="forge-spark forge-spark-b" aria-hidden="true" />
              <span className="forge-spark forge-spark-c" aria-hidden="true" />
            </div>
          </div>
          <PixelSprite
            kind="sir"
            size={86}
            className="absolute bottom-5 right-[12%] opacity-80 drop-shadow-[0_5px_0_rgba(0,0,0,0.5)]"
          />
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-pixel text-[0.62rem] text-gold">{phase.label}</p>
              <p className="mt-1 truncate text-[0.7rem] text-ash">
                {fileName ? fileName : "Naskah"}
              </p>
            </div>
            <span className="font-pixel text-sm text-bone">{progress}%</span>
          </div>

          <p className="mt-2 min-h-10 text-sm leading-6 text-ash">{phase.detail}</p>

          <div className="bar-track mt-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div className="bar-fill transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>

          <ol className="mt-4 space-y-1.5" aria-hidden="true">
            {PHASES.map((item, index) => {
              const state = index < phaseIndex ? "done" : index === phaseIndex ? "active" : "todo";
              return (
                <li
                  key={item.label}
                  className={`flex items-center gap-2 text-[0.68rem] ${
                    state === "done"
                      ? "text-moss"
                      : state === "active"
                        ? "text-bone"
                        : "text-ash/50"
                  }`}
                >
                  <span
                    className={`grid h-4 w-4 place-items-center border text-[0.46rem] ${
                      state === "done"
                        ? "border-moss/60 bg-moss/15"
                        : state === "active"
                          ? "border-gold bg-gold text-void"
                          : "border-ridge bg-void/60"
                    }`}
                  >
                    {state === "done" ? "✓" : index + 1}
                  </span>
                  {item.label}
                </li>
              );
            })}
          </ol>

          <div className="mt-4 border-2 border-void bg-tomb/60 p-3">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-gold">Catatan</p>
            <p className="mt-1 text-[0.76rem] leading-5 text-ash">{tip}</p>
          </div>

          <p className="mt-3 text-center text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash/65">
            Jangan tutup halaman ini
          </p>
        </div>
      </div>
    </div>
  );
}
