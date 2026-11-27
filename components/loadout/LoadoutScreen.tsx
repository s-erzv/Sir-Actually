"use client";

import { useEffect, useMemo, useState } from "react";
import { playSfx } from "@/game/audio";
import { useMusic } from "@/lib/useMusic";
import { HEART_HP } from "@/lib/balance";
import GameMenu from "@/components/ui/GameMenu";
import { CharacterSprite } from "@/components/ui/SheetSprite";
import { authJson } from "@/lib/api/client";
import {
  CHARACTERS,
  isValidLoadout,
  type CharacterSlug,
  type Loadout,
  type WeaponSlug,
} from "@/lib/loadout";

interface LoadoutScreenProps {
  onStart: (loadout: Loadout) => void;
}

interface CatalogResponse {
  pointsBalance: number;
  characters: Array<{ slug: CharacterSlug; unlockCost: number; unlocked: boolean }>;
}

export default function LoadoutScreen({ onStart }: LoadoutScreenProps) {
  useMusic("camp");
  const [characterSlug, setCharacterSlug] = useState<CharacterSlug>("arka");
  const [weaponSlug, setWeaponSlug] = useState<WeaponSlug>("pedang_sitasi");
  const [unlocked, setUnlocked] = useState<Set<CharacterSlug>>(
    () =>
      new Set(
        CHARACTERS.filter((character) => character.unlockCost === 0).map(
          (character) => character.slug,
        ),
      ),
  );
  const [pointsBalance, setPointsBalance] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<CharacterSlug | null>(null);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const character = CHARACTERS.find((item) => item.slug === characterSlug)!;
  const targetInfo = unlockTarget
    ? CHARACTERS.find((item) => item.slug === unlockTarget) ?? null
    : null;

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const data = await authJson<CatalogResponse>("/api/loadout");
        if (cancelled) return;
        setPointsBalance(data.pointsBalance);
        setUnlocked(
          new Set(
            data.characters
              .filter((item) => item.unlocked)
              .map((item) => item.slug),
          ),
        );
      } catch (err) {
        if (!cancelled) {
          setCatalogError(err instanceof Error ? err.message : "Gagal memuat karakter.");
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  function chooseCharacter(next: CharacterSlug) {
    if (!unlocked.has(next)) {
      setUnlockError(null);
      setUnlockTarget(next);
      return;
    }
    const nextCharacter = CHARACTERS.find((item) => item.slug === next);
    setCharacterSlug(next);
    if (nextCharacter) setWeaponSlug(nextCharacter.weaponSlugs[0]!);
  }

  async function unlockCharacter() {
    if (!unlockTarget || unlockBusy) return;
    setUnlockBusy(true);
    setUnlockError(null);
    try {
      const data = await authJson<{
        pointsBalance: number;
        unlockedCharacters: CharacterSlug[];
      }>("/api/loadout/unlock", {
        method: "POST",
        body: JSON.stringify({ characterSlug: unlockTarget }),
      });
      setPointsBalance(data.pointsBalance);
      setUnlocked(new Set(data.unlockedCharacters));
      setCharacterSlug(unlockTarget);
      setUnlockTarget(null);
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : "Gagal membuka karakter.");
    } finally {
      setUnlockBusy(false);
    }
  }

  const canStart = useMemo(
    () => unlocked.has(characterSlug) && isValidLoadout(characterSlug, weaponSlug),
    [unlocked, characterSlug, weaponSlug],
  );

  const index = CHARACTERS.findIndex((item) => item.slug === characterSlug);

  function step(delta: number) {
    const next = CHARACTERS[(index + delta + CHARACTERS.length) % CHARACTERS.length]!;
    playSfx("uiMove");
    setCharacterSlug(next.slug);
    setWeaponSlug(next.weaponSlugs[0]!);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (unlockTarget) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      step(event.key === "ArrowRight" ? 1 : -1);
    }
  }

  const locked = !unlocked.has(characterSlug);

  return (
    <main className="font-game flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-4 py-16" onKeyDown={onKeyDown}>
      <h1 className="g-2 text-[var(--ui-cream)]" style={{ textShadow: "3px 3px 0 var(--ui-ink)" }}>
        Pilih karakter
      </h1>

      <div className="flex items-end gap-2 sm:gap-4" role="radiogroup" aria-label="Karakter">
        {CHARACTERS.map((item) => {
          const active = item.slug === characterSlug;
          return (
            <button
              key={item.slug}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={item.name}
              data-sfx="uiMove"
              onClick={() => {
                setCharacterSlug(item.slug);
                setWeaponSlug(item.weaponSlugs[0]!);
              }}
              className={`ui-slot cursor-pointer ${active ? "h-24 w-24 sm:h-28 sm:w-28" : "h-16 w-16 opacity-70 hover:opacity-100"} ${unlocked.has(item.slug) ? "" : "grayscale"}`}
            >
              <CharacterSprite slug={item.slug} facing="down" scale={active ? 5 : 3} walking={active} />
            </button>
          );
        })}
      </div>

      <section className="ui-box w-full max-w-[30rem]" aria-live="polite">
        <div className="g-1 flex items-baseline justify-between gap-2">
          <span className="g-2">{character.name}</span>
          <span>HP {character.hearts * HEART_HP}</span>
        </div>
        <p className="g-1 text-[var(--ui-rust)]">{character.title}</p>
        <p className="g-1 mt-1">{character.passive}</p>
        {catalogError ? <p className="g-1 mt-1 text-[#a3341f]">{catalogError}</p> : null}
      </section>

      {unlockTarget && targetInfo ? (
        <section className="ui-box w-full max-w-[30rem]" role="alertdialog" aria-label="Buka karakter">
          <p className="g-1">
            Buka {targetInfo.name} dengan {targetInfo.unlockCost} koin? Kamu punya {pointsBalance}.
          </p>
          {unlockError ? <p className="g-1 text-[#a3341f]">{unlockError}</p> : null}
          <GameMenu
            key="unlock"
            label="Buka karakter"
            columns={2}
            items={[
              { key: "no", label: "Tidak", sfx: "uiCancel", onSelect: () => setUnlockTarget(null) },
              {
                key: "yes",
                label: unlockBusy ? "Membuka..." : "Ya, buka",
                disabled: unlockBusy || pointsBalance < targetInfo.unlockCost,
                onSelect: () => void unlockCharacter(),
              },
            ]}
          />
        </section>
      ) : (
        <button
          type="button"
          autoFocus
          disabled={catalogLoading}
          onClick={() => (locked ? chooseCharacter(characterSlug) : canStart && onStart({ characterSlug, weaponSlug }))}
          className="ui-btn min-w-[14rem]"
        >
          {catalogLoading ? "Memuat..." : locked ? `Buka ${character.name}` : `Pilih ${character.name}`}
        </button>
      )}
      <p className="g-1 text-[var(--ui-cream)] opacity-60">Kiri / kanan: ganti karakter</p>
    </main>
  );
}
