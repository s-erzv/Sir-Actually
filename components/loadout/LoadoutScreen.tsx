"use client";

import { useEffect, useMemo, useState } from "react";
import { PixelSprite, heroForCharacter } from "@/components/brand/PixelSprite";
import QuestPath from "@/components/game/QuestPath";
import { authJson } from "@/lib/api/client";
import {
  CHARACTERS,
  WEAPONS,
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
  const [characterSlug, setCharacterSlug] = useState<CharacterSlug>("arka");
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
  const weaponSlug: WeaponSlug = character.weaponSlugs[0]!;
  const arsenal = WEAPONS.filter((weapon) => weapon.characterSlug === characterSlug);
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
    setCharacterSlug(next);
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

  return (
    <main className="dungeon-bg scanlines min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <QuestPath current="loadout" className="mb-6" />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Pos 04 · Persiapan</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-bone sm:text-4xl">
              Pilih penjaga.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ash">
              Karakter mengubah cara kamu bertahan. Senjata dipilih otomatis dari
              jawabanmu, bukan dari menu.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="pixel-chip border-gold/40 text-gold">
              {catalogLoading ? "Memuat poin..." : `${pointsBalance} poin`}
            </span>
            <span className="pixel-chip">{character.hearts} Heart awal</span>
          </div>
        </div>

        {catalogError ? (
          <p className="mt-4 border border-blood/40 bg-blood/10 p-2 text-xs text-blood">
            {catalogError}
          </p>
        ) : null}

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Pilih karakter">
          {CHARACTERS.map((item) => {
            const active = item.slug === characterSlug;
            const isUnlocked = unlocked.has(item.slug);
            const locked = !isUnlocked;
            return (
              <button
                key={item.slug}
                type="button"
                onClick={() => chooseCharacter(item.slug)}
                aria-pressed={active}
                aria-disabled={locked}
                className={`group relative overflow-hidden border-2 p-0 text-left transition ${
                  active
                    ? "border-gold bg-gold/10 shadow-[4px_4px_0_#05080b,0_0_24px_rgba(233,184,93,0.14)]"
                    : locked
                      ? "border-ridge/60 bg-[#090d12] hover:border-blood/60"
                      : "border-ridge bg-[#0c141d] hover:border-gold/70"
                }`}
              >
                <div className="tile-floor relative flex h-32 items-end justify-center border-b-2 border-void">
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-5 wall-stone" />
                  <span className="absolute bottom-7 h-3 w-16 bg-black/50 blur-[1px]" aria-hidden="true" />
                  <PixelSprite
                    kind={heroForCharacter(item.slug)}
                    size={92}
                    className={`relative -mb-1 transition-transform duration-200 ${
                      locked ? "grayscale opacity-35" : active ? "-translate-y-1" : "group-hover:-translate-y-1"
                    }`}
                  />
                  <span className="absolute left-2 top-2 font-pixel text-[0.52rem] text-ash">
                    {String(CHARACTERS.indexOf(item) + 1).padStart(2, "0")}
                  </span>
                  {locked ? (
                    <span className="absolute inset-0 grid place-items-center bg-[#05080b]/55">
                      <span className="border-2 border-blood/60 bg-void/90 px-2 py-1 font-pixel text-[0.5rem] text-blood">
                        TERKUNCI · {item.unlockCost} POIN
                      </span>
                    </span>
                  ) : active ? (
                    <span className="absolute right-2 top-2 border border-gold bg-void/90 px-1.5 py-0.5 font-pixel text-[0.46rem] text-gold">
                      DIPILIH
                    </span>
                  ) : null}
                </div>
                <div className="p-3">
                  <p className="font-pixel text-[0.5rem] text-gold">{item.title}</p>
                  <h2 className="mt-1 text-lg font-bold leading-none text-bone">{item.name}</h2>
                  <p className="mt-1 text-[0.66rem] uppercase tracking-[0.07em] text-ash">
                    {item.role}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="flex gap-1" aria-label={`${item.hearts} Heart`}>
                      {Array.from({ length: item.hearts }).map((_, index) => (
                        <span key={index} className="h-2.5 w-2.5 bg-blood" aria-hidden="true" />
                      ))}
                    </span>
                    <span className="text-[0.62rem] font-bold text-ash">
                      {locked ? `${item.unlockCost} poin` : `${item.hearts} Heart`}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="pixel-panel p-4 sm:p-5">
            <div className="flex items-start gap-4 border-b-2 border-void pb-4">
              <div className="tile-floor grid h-20 w-20 shrink-0 place-items-end justify-items-center border-2 border-void pb-2">
                <PixelSprite kind={heroForCharacter(character.slug)} size={62} />
              </div>
              <div className="min-w-0">
                <p className="font-pixel text-[0.52rem] text-gold">{character.title}</p>
                <h2 className="mt-1 text-xl font-bold text-bone">{character.name}</h2>
                <p className="mt-1 text-[0.78rem] leading-5 text-ash">{character.passive}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="font-pixel text-[0.56rem] text-gold">Arsenal otomatis</p>
              <span className="text-[0.58rem] font-bold uppercase tracking-[0.08em] text-ash/70">
                Server pilih per jawaban
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {arsenal.map((item) => (
                <div key={item.slug} className="border-2 border-ridge/60 bg-void/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-bone">{item.name}</h3>
                    <span className="font-pixel text-[0.48rem] text-ash">
                      x{item.baseBonus.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-2 text-[0.72rem] leading-5 text-ash">{item.condition}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[0.7rem] leading-5 text-ash/75">
              Nggak ada menu pilih senjata. Begitu kamu menekan Serang, server mencocokkan
              jawabanmu dengan arsenal karakter dan memakai senjata yang paling cocok.
            </p>
          </section>

          <aside className="pixel-panel-gold pixel-panel flex flex-col p-4 sm:p-5">
            <p className="font-pixel text-[0.56rem] text-gold">Rakitan ekspedisi</p>

            <dl className="mt-4 space-y-3 border-y-2 border-void py-4">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-ash">
                  Karakter
                </dt>
                <dd className="text-sm font-bold text-bone">{character.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-ash">
                  Senjata
                </dt>
                <dd className="text-sm font-bold text-gold">Otomatis</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-ash">
                  Heart
                </dt>
                <dd className="flex items-center gap-1.5 text-sm font-bold text-blood">
                  <span aria-hidden="true">♥</span> {character.hearts}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-ash">
                  Poin
                </dt>
                <dd className="font-pixel text-[0.56rem] text-gold">{pointsBalance}</dd>
              </div>
            </dl>

            <p className="mt-4 text-[0.74rem] leading-5 text-ash">
              Senjata hanya mengubah damage. Penilaian jawaban tetap memakai rubrik
              yang sama untuk semua pemain.
            </p>

            <div className="mt-auto pt-5">
              <button
                type="button"
                onClick={() => onStart({ characterSlug, weaponSlug })}
                disabled={!canStart}
                className="pixel-button w-full border-gold bg-gold px-5 text-void hover:bg-bone disabled:opacity-50"
              >
                Turun ke dungeon <span aria-hidden="true">↓</span>
              </button>
              <p className="mt-3 text-center text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash/70">
                Loadout terkunci selama run
              </p>
            </div>
          </aside>
        </div>
      </div>

      {targetInfo ? (
        <div
          className="game-fade fixed inset-0 z-50 grid place-items-center bg-[#05080b]/90 px-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={`Buka karakter ${targetInfo.name}`}
        >
          <div className="game-screen-in w-full max-w-sm border-2 border-gold bg-[#0a0f14] p-5 shadow-[8px_8px_0_#05080b]">
            <p className="font-pixel text-[0.56rem] text-gold">KARAKTER TERKUNCI</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="tile-floor grid h-16 w-16 shrink-0 place-items-end justify-items-center border-2 border-void pb-1.5">
                <PixelSprite kind={heroForCharacter(targetInfo.slug)} size={50} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-bone">{targetInfo.name}</h2>
                <p className="text-[0.7rem] uppercase tracking-[0.08em] text-ash">
                  {targetInfo.title}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[0.78rem] leading-5 text-ash">{targetInfo.passive}</p>
            <div className="mt-4 flex items-center justify-between border-y-2 border-void py-2 text-sm">
              <span className="text-ash">Harga buka</span>
              <span className="font-pixel text-gold">{targetInfo.unlockCost} poin</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-ash">Poin kamu</span>
              <span className={`font-pixel ${pointsBalance >= targetInfo.unlockCost ? "text-moss" : "text-blood"}`}>
                {pointsBalance}
              </span>
            </div>
            {unlockError ? (
              <p className="mt-3 border border-blood/40 bg-blood/10 p-2 text-xs text-blood">
                {unlockError}
              </p>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUnlockTarget(null)}
                disabled={unlockBusy}
                className="pixel-button pixel-button-sm border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void unlockCharacter()}
                disabled={unlockBusy || pointsBalance < targetInfo.unlockCost}
                className="pixel-button pixel-button-sm border-gold bg-gold text-void hover:bg-bone"
              >
                {unlockBusy ? "Membuka..." : "Buka"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
