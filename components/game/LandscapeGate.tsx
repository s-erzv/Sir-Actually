/** Phone players must rotate: the dungeon needs horizontal room. */
export default function LandscapeGate() {
  return (
    <div className="landscape-gate fixed inset-0 z-[90] flex-col items-center justify-center gap-4 bg-[#05080b] px-8 text-center">
      <div className="flex h-16 w-28 items-center justify-center border-2 border-gold/70 bg-[#0a0f14] shadow-[4px_4px_0_#05080b]">
        <span className="h-8 w-14 border-2 border-ridge bg-[#16202b]" aria-hidden="true" />
      </div>
      <p className="font-pixel text-[0.68rem] uppercase tracking-[0.12em] text-gold">
        Putar perangkat
      </p>
      <p className="max-w-xs text-sm leading-6 text-ash">
        Dungeon dimainkan dalam posisi lanskap. Putar ponselmu untuk melanjutkan.
      </p>
    </div>
  );
}
