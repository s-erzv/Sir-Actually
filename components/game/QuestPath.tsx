export type QuestStage = "manuscript" | "map" | "recon" | "loadout" | "dungeon";

const STAGES: Array<{ id: QuestStage; label: string; short: string }> = [
  { id: "manuscript", label: "Naskah", short: "01" },
  { id: "map", label: "Peta", short: "02" },
  { id: "recon", label: "Recon", short: "03" },
  { id: "loadout", label: "Karakter", short: "04" },
  { id: "dungeon", label: "Dungeon", short: "05" },
];

interface QuestPathProps {
  current: QuestStage;
  className?: string;
}

export default function QuestPath({ current, className = "" }: QuestPathProps) {
  const currentIndex = STAGES.findIndex((stage) => stage.id === current);

  return (
    <nav aria-label="Alur ekspedisi" className={className}>
      <ol className="flex items-stretch overflow-x-auto border-2 border-void bg-[#0a0f14]/85 shadow-[inset_0_0_0_1px_#34424e]">
        {STAGES.map((stage, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={stage.id} className="flex min-w-0 flex-1 items-center">
              <div
                className={`flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 sm:px-3 ${
                  active ? "bg-gold/10" : ""
                }`}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center border text-[0.6rem] font-bold ${
                    active
                      ? "border-gold bg-gold text-void"
                      : done
                        ? "border-moss/60 bg-moss/15 text-moss"
                        : "border-ridge bg-void/60 text-ash"
                  }`}
                  aria-hidden="true"
                >
                  {done ? "✓" : stage.short}
                </span>
                <span
                  className={`truncate text-[0.62rem] font-bold uppercase tracking-[0.06em] ${
                    active ? "text-gold" : done ? "text-bone" : "text-ash/70"
                  }`}
                >
                  {stage.label}
                </span>
                <span className="sr-only">
                  {done ? "selesai" : active ? "tahap sekarang" : "belum dibuka"}
                </span>
              </div>
              {index < STAGES.length - 1 ? (
                <span
                  className={`h-8 w-0.5 shrink-0 ${done ? "bg-moss/40" : "bg-ridge/50"}`}
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
