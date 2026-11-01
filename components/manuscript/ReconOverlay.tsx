"use client";

import { PixelSprite } from "@/components/brand/PixelSprite";

const STEPS = [
  { step: "citations", label: "Memeriksa rujukan" },
  { step: "code", label: "Menjalankan detektor kode" },
  { step: "llm", label: "AI membaca klaim" },
] as const;

interface ReconOverlayProps {
  step: string | null;
  stepsDone: number;
  stepsTotal: number;
  progressText: string;
}

export default function ReconOverlay({
  step,
  stepsDone,
  stepsTotal,
  progressText,
}: ReconOverlayProps) {
  const progress = Math.min(95, Math.round((stepsDone / Math.max(1, stepsTotal)) * 100));

  return (
    <div
      className="game-fade fixed inset-0 z-50 grid place-items-center bg-[#05080b]/92 px-4 py-6 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-busy="true"
      aria-label="Recon naskah"
    >
      <div className="game-screen-in w-full max-w-md border-2 border-gold bg-[#0a0f14] shadow-[8px_8px_0_#05080b,0_0_70px_rgba(233,184,93,0.12)]">
        <div className="flex items-center justify-between border-b-2 border-void bg-tomb px-3 py-2">
          <span className="font-pixel text-[0.54rem] text-gold">RECON · MENCARI CELAH</span>
          <span className="flex items-center gap-1.5 text-[0.58rem] font-bold uppercase tracking-[0.08em] text-ember">
            <span className="h-2 w-2 animate-flicker bg-ember" aria-hidden="true" />
            {stepsDone}/{stepsTotal}
          </span>
        </div>

        <div className="tile-floor relative h-40 overflow-hidden border-b-2 border-void">
          <div className="wall-stone absolute inset-x-0 top-0 h-7 border-b-2 border-void" />
          <div className="wall-stone absolute inset-x-0 bottom-0 h-6 border-t-2 border-void" />
          <span className="torch-flame absolute left-6 top-10" />
          <span className="torch-flame absolute right-6 top-10" />
          <div className="forge-scan pointer-events-none absolute inset-y-5 w-14 bg-[linear-gradient(90deg,transparent,rgba(143,149,217,0.25),transparent)]" aria-hidden="true" />
          <PixelSprite kind="hero" size={64} className="absolute bottom-4 left-[16%]" />
          <PixelSprite kind="references" size={72} className="absolute bottom-4 left-1/2 -translate-x-1/2" />
          <PixelSprite kind="gap" size={66} className="absolute bottom-4 right-[14%]" />
        </div>

        <div className="p-5">
          <p className="font-pixel text-[0.6rem] text-gold">{progressText}</p>
          <p className="mt-2 text-sm leading-6 text-ash">
            Mencocokkan kutipan, memeriksa rujukan, lalu menilai klaim. Jangan tutup halaman.
          </p>

          <div className="bar-track mt-4" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div className="bar-fill transition-[width] duration-500 ease-out" style={{ width: `${Math.max(6, progress)}%` }} />
          </div>

          <ol className="mt-4 space-y-1.5">
            {STEPS.map((item, index) => {
              const active = item.step === step;
              const done = index < stepsDone;
              return (
                <li
                  key={item.step}
                  className={`flex items-center gap-2 text-[0.68rem] ${
                    done ? "text-moss" : active ? "text-bone" : "text-ash/50"
                  }`}
                >
                  <span
                    className={`grid h-4 w-4 place-items-center border text-[0.46rem] ${
                      done
                        ? "border-moss/60 bg-moss/15"
                        : active
                          ? "border-gold bg-gold text-void"
                          : "border-ridge bg-void/60"
                    }`}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  {item.label}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
