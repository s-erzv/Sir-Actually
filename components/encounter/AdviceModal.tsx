"use client";

import type { WeaknessType } from "@/lib/domain/types";
import { ADVICE_TEMPLATES } from "@/lib/advice";
import { PixelSprite } from "@/components/brand/PixelSprite";

interface AdviceModalProps {
  weaknessType: WeaknessType;
  evidenceQuote: string;
  onRetry: () => void;
  onRevise: () => void;
}

export default function AdviceModal({
  weaknessType,
  evidenceQuote,
  onRetry,
  onRevise,
}: AdviceModalProps) {
  const template = ADVICE_TEMPLATES[weaknessType];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-void/90 px-4 backdrop-blur-sm">
      <div className="parchment max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b-2 border-[#a98e5d] pb-3">
          <div>
            <p className="font-pixel text-[0.58rem] text-[#6b4b1e]">Kitab nasihat</p>
            <h2 className="mt-2 text-xl font-bold text-[#2b2318]">Sebelum mencoba lagi.</h2>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center border-2 border-[#2c2114] bg-[#d9c18b]">
            <PixelSprite kind="scroll" size={32} />
          </div>
        </div>

        {evidenceQuote ? (
          <blockquote className="mt-4 border-l-2 border-[#a98e5d] bg-[#e3d0a6]/65 py-2 pl-3 text-sm italic leading-6 text-[#4a3a25]">
            {evidenceQuote}
          </blockquote>
        ) : null}

        <p className="mt-4 text-[0.95rem] leading-7 text-[#2b2318]">
          {template.problemDescription}
        </p>

        <div className="mt-5">
          <p className="font-pixel text-[0.56rem] leading-4 text-[#6b4b1e]">
            Pertanyaan yang perlu kamu putuskan
          </p>
          <ul className="mt-3 space-y-2.5">
            {template.checklistItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-6 text-[#4a3a25]">
                <span className="mt-0.5 shrink-0 font-pixel text-[0.6rem] text-[#8a5a1f]" aria-hidden="true">
                  □
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-5 border-t-2 border-[#a98e5d] pt-3 text-xs leading-5 text-[#6d5c3f]">
          Kitab Nasihat bukan pengganti dosen pembimbing. Pertanyaan di atas adalah
          titik awal refleksi — keputusan ada di tanganmu.
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            onClick={onRevise}
            disabled
            title="Tersedia di M3"
            className="pixel-button pixel-button-sm cursor-not-allowed border-[#2c2114] bg-[#d9c18b] text-[#6d5c3f] opacity-55"
          >
            Perbaiki naskah
          </button>
          <button
            onClick={onRetry}
            className="pixel-button pixel-button-sm border-[#2c2114] bg-[#2b2318] text-[#f4e7c7] hover:bg-[#4a3a25]"
          >
            Ulangi lantai
          </button>
        </div>
      </div>
    </div>
  );
}
