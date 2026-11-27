"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authJson } from "@/lib/api/client";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { playSfx } from "@/game/audio";
import type { ItemDef } from "@/lib/combat/items";
import type { EquippedArmor, EquippedWeapon } from "@/lib/combat/shop";
import GameMenu from "@/components/ui/GameMenu";

interface ShopState {
  coins: number;
  potions: number;
  bagMax: number;
  hp: number;
  hpMax: number;
  weapon: EquippedWeapon | null;
  armor: EquippedArmor | null;
  items: ItemDef[];
}

interface ShopModalProps {
  runId: string;
  floor: number;
  onClose: () => void;
  onVitals: (state: {
    hp: number;
    hpMax: number;
    coins: number;
    potions: number;
    weapon: EquippedWeapon | null;
    armor: EquippedArmor | null;
  }) => void;
}

/** What the item does, compared with what is equipped now. */
function describe(item: ItemDef, state: ShopState): string {
  if (item.kind === "potion") return `Pulihkan ${item.heal} HP. Masuk tas.`;
  if (item.kind === "weapon") {
    const now = state.weapon ? `Sekarang: ${state.weapon.name} +${state.weapon.power}.` : "Sekarang: tangan kosong.";
    return `Serangan +${item.power}. ${now}`;
  }
  const now = state.armor
    ? `Sekarang: ${state.armor.name} ${state.armor.shield}/${state.armor.shieldMax}.`
    : "Sekarang: tanpa armor.";
  return `Shield ${item.shield}. Menahan serangan sebelum HP. ${now}`;
}

function equipped(item: ItemDef, state: ShopState): boolean {
  if (item.kind === "weapon") return state.weapon?.slug === item.slug;
  if (item.kind === "armor") return state.armor?.slug === item.slug && state.armor.shield >= state.armor.shieldMax;
  return false;
}

/** The floor merchant: pick a row to buy; gear is equipped at once. */
export default function ShopModal({ runId, floor, onClose, onVitals }: ShopModalProps) {
  const [state, setState] = useState<ShopState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);
  const pending = useRef<{ item: string; id: string } | null>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>();

  const apply = useCallback(
    (data: ShopState) => {
      setState(data);
      onVitals({
        hp: data.hp,
        hpMax: data.hpMax,
        coins: data.coins,
        potions: data.potions,
        weapon: data.weapon,
        armor: data.armor,
      });
    },
    [onVitals],
  );

  useEffect(() => {
    let cancelled = false;
    authJson<ShopState>(`/api/run/shop?runId=${runId}&floor=${floor}`)
      .then((data) => {
        if (!cancelled) apply(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Toko tutup.");
      });
    return () => {
      cancelled = true;
    };
  }, [runId, floor, apply]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const buy = useCallback(
    async (item: ItemDef) => {
      if (pending.current?.item === item.slug) return;
      pending.current = { item: item.slug, id: crypto.randomUUID() };
      setBusy(item.slug);
      setError(null);
      setNotice(null);
      try {
        const data = await authJson<ShopState>("/api/run/shop", {
          method: "POST",
          body: JSON.stringify({ runId, floor, item: item.slug, purchaseId: pending.current.id }),
        });
        apply(data);
        playSfx(item.kind === "potion" ? "coin" : "powerup");
        setNotice(item.kind === "potion" ? `${item.name} masuk tas.` : `${item.name} terpasang!`);
      } catch (err) {
        playSfx("alert");
        setError(err instanceof Error ? err.message : "Gagal membeli.");
      } finally {
        pending.current = null;
        setBusy(null);
      }
    },
    [runId, floor, apply],
  );

  const items = state?.items ?? [];
  const focused = items[focus];
  const message =
    error ??
    notice ??
    (!state ? "Sebentar..." : focused ? describe(focused, state) : "Hati-hati di bawah sana.");

  return (
    <div
      className="font-game fixed inset-0 z-[70] flex items-center justify-center bg-[#05080b]/70 px-3 py-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Toko" className="grid w-full max-w-[32rem] gap-2">
        <div className="flex items-end justify-between gap-2">
          <div className="ui-chip flex items-center gap-2">
            <img
              src="/assets/ninja-adventure/npc/merchant-face.png"
              alt=""
              width={48}
              height={48}
              className="ui-icon"
            />
            <span className="g-1">Pedagang lantai {floor}</span>
          </div>
          <span className="ui-chip g-1 flex items-center gap-1" aria-label={`${state?.coins ?? 0} koin`}>
            <img src="/assets/ninja-adventure/items/coin-gold.png" alt="" width={14} height={14} className="ui-icon" />
            {state?.coins ?? "-"}
          </span>
        </div>

        <nav className="ui-box" aria-label="Barang">
          <GameMenu
            key={state ? "ready" : "loading"}
            label="Barang"
            onActiveChange={setFocus}
            items={[
              ...items.map((item) => {
                const isEquipped = state ? equipped(item, state) : false;
                const bagFull = item.kind === "potion" && state !== null && state.potions >= state.bagMax;
                return {
                  key: item.slug,
                  sfx: "none" as const,
                  disabled: busy !== null || !state || isEquipped || bagFull || state.coins < item.price,
                  label: (
                    <span className="flex items-center gap-2">
                      <span className="ui-slot h-8 w-8 shrink-0">
                        <img src={item.icon} alt="" width={20} height={20} className="ui-icon h-5 w-5 object-contain" />
                      </span>
                      {busy === item.slug ? "..." : item.name}
                    </span>
                  ),
                  aside: isEquipped ? "Terpasang" : bagFull ? "Tas penuh" : `${item.price}`,
                  onSelect: () => void buy(item),
                };
              }),
              { key: "close", label: "Keluar", sfx: "uiCancel" as const, onSelect: onClose },
            ]}
          />
        </nav>

        <p className="ui-box g-1 min-h-[4.5rem]" role="status" aria-live="polite">
          <span className={error ? "text-[#a3341f]" : ""}>{message}</span>
          {state ? (
            <span className="block text-[var(--ui-rust)]">
              HP {state.hp}/{state.hpMax} · Tas {state.potions}/{state.bagMax}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
