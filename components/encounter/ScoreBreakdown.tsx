"use client";

import type { EvaluationResult } from "@/lib/domain/types";
import type { WeaknessType } from "@/lib/domain/types";
import { RUBRICS } from "@/lib/rubrics";

interface ScoreBreakdownProps {
  evaluation: EvaluationResult;
  weaknessType: WeaknessType;
}

const LEVEL_LABEL: Record<0 | 1 | 2, string> = {
  0: "Tidak ada",
  1: "Disebut",
  2: "Didukung",
};

const LEVEL_COLOR: Record<0 | 1 | 2, string> = {
  0: "#a1abb3",
  1: "#e9b85d",
  2: "#8fbd72",
};

export default function ScoreBreakdown({ evaluation, weaknessType }: ScoreBreakdownProps) {
  const criteria = RUBRICS[weaknessType] ?? [];
  const { scores, scoreTotal, scoreMax, missing, ruleCaps } = evaluation;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash">Skor jawaban</span>
        <div className="flex gap-1">
          {Array.from({ length: scoreMax }, (_, i) => (
            <span
              key={i}
              className={`h-3 w-3 border border-void ${i < scoreTotal ? "bg-gold" : "bg-ridge/50"}`}
            />
          ))}
        </div>
        <span className="ml-auto font-pixel text-[0.62rem] tabular-nums text-bone">
          {scoreTotal}/{scoreMax}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {criteria.map((criterion) => {
          const score = scores.find((s) => s.criterionId === criterion.id);
          const level = (score?.level ?? 0) as 0 | 1 | 2;
          const isCapped = score?.capApplied ?? false;
          const cap = ruleCaps.find((c) => c.criterionId === criterion.id);

          return (
            <div key={criterion.id} className="flex items-start gap-2">
              <span
                className="mt-1 h-2 w-2 shrink-0"
                style={{ background: LEVEL_COLOR[level] }}
              />
              <div className="min-w-0 flex-1">
                <span className="text-[0.82rem] leading-5 text-bone">{criterion.label}</span>
                <span
                  className="ml-2 text-[0.62rem] font-bold uppercase tracking-[0.06em]"
                  style={{ color: LEVEL_COLOR[level] }}
                >
                  {LEVEL_LABEL[level]}
                </span>
                {isCapped && cap && (
                  <p className="mt-0.5 text-xs leading-5 text-gold">Dibatasi: {cap.reason}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {missing && (
        <p className="border-t-2 border-void pt-2 text-sm italic leading-6 text-ash">
          {missing}
        </p>
      )}
    </div>
  );
}
