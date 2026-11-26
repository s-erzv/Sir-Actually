"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authJson } from "@/lib/api/client";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface ShopItem {
  slug: "potion_small" | "potion_large" | "potion_heart";
  name: string;
  heal: number;
  price: number;
}

interface ShopState {
  coins: number;
  potions: number;
  bagMax: number;
  hp: number;
  hpMax: number;
  items: ShopItem[];
}

interface ShopModalProps {
  runId: string;
  floor: number;
  onClose: () => void;
  onVitals: (state: { hp: number; hpMax: number; coins: number; potions: number }) => void;
}

export default function ShopModal({ runId, floor, onClose, onVitals }: ShopModalProps) {
  const [state, setState] = useState<ShopState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<{ item: ShopItem["slug"]; id: string } | null>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>();

  const apply = useCallback(
    (data: ShopState) => {
      setState(data);
      onVitals({ hp: data.hp, hpMax: data.hpMax, coins: data.coins, potions: data.potions });
    },
    [onVitals],
  );

  useEffect(() => {
    let cancelled = false;
    authJson<ShopState>(`/api/run/shop?runId=${runId}`)
      .then((data) => {
        if (!cancelled) apply(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal membuka peti.");
      });
    return () => {
      cancelled = true;
    };
  }, [runId, apply]);

  const buy = useCallback(
    async (item: ShopItem["slug"]) => {
      if (pending.current?.item === item) return;
      pending.current = { item, id: crypto.randomUUID() };
      setBusy(item);
      setError(null);
      try {
        const data = await authJson<ShopState>("/api/run/shop", {
          method: "POST",
          body: JSON.stringify({
            runId,
            floor,
            item,
            purchaseId: pending.current.id,
          }),
        });
        apply(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membeli ramuan.");
      } finally {
        pending.current = null;
        setBusy(null);
      }
    },
    [runId, floor, apply],
  );

  return (
    <div className="game-fade fixed inset-0 z-[70] grid place-items-center bg-[#05080b]/92 px-3 py-4 backdrop-blur-[2px]">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Peti harta"
        className="game-screen-in max-h-[92vh] w-full max-w-lg overflow-y-auto border-2 border-gold bg-[#0a0f14] shadow-[8px_8px_0_#05080b,0_0_50px_rgba(233,184,93,0.12)]"
      >
        <div className="flex items-center justify-between border-b-2 border-void bg-tomb px-4 py-2">
          <span className="font-pixel text-[0.56rem] text-gold">PETI HARTA · LANTAI {floor}</span>
          <button
            type="button"
            onClick={onClose}
            className="border border-ridge bg-void px-2 py-0.5 font-pixel text-[0.5rem] text-ash hover:border-gold hover:text-gold"
          >
            TUTUP
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2 border-2 border-void bg-void/50 p-3 text-center">
            <span>
              <span className="block text-[0.5rem] uppercase tracking-[0.08em] text-ash">Koin</span>
              <span className="mt-1 block font-pixel text-sm text-gold">{state?.coins ?? "—"}</span>
            </span>
            <span>
              <span className="block text-[0.5rem] uppercase tracking-[0.08em] text-ash">HP</span>
              <span className="mt-1 block font-pixel text-sm text-moss">
                {state ? `${state.hp}/${state.hpMax}` : "—"}
              </span>
            </span>
            <span>
              <span className="block text-[0.5rem] uppercase tracking-[0.08em] text-ash">Tas</span>
              <span className="mt-1 block font-pixel text-sm text-bone">
                {state ? `${state.potions}/${state.bagMax}` : "—"}
              </span>
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {(state?.items ?? []).map((item) => (
              <div
                key={item.slug}
                className="flex items-center justify-between gap-3 border-2 border-ridge/60 bg-[#0c141d] p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-bone">{item.name}</p>
                  <p className="mt-0.5 text-[0.66rem] text-ash">
                    {item.slug === "potion_heart" ? "Isi ulang 1 Heart" : `Pulihkan ${item.heal} HP`} ·{" "}
                    {item.price} koin
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!state || busy !== null || state.coins < item.price || state.potions >= state.bagMax}
                  onClick={() => void buy(item.slug)}
                  className="pixel-button pixel-button-sm shrink-0 border-gold bg-gold text-void hover:bg-bone disabled:opacity-40"
                >
                  {busy === item.slug ? "..." : "Beli"}
                </button>
              </div>
            ))}
          </div>

          {error ? (
            <p className="mt-3 border border-blood/40 bg-blood/10 p-2 text-xs leading-5 text-blood">
              {error}
            </p>
          ) : null}

          <p className="mt-4 border-t border-ridge/40 pt-3 text-[0.66rem] leading-5 text-ash">
            Ramuan disimpan di tas. Minum lewat tombol Ramuan di HUD saat tidak sedang bertarung.
          </p>
        </div>
      </div>
    </div>
  );
}
