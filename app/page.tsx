"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/game/audio";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useMusic } from "@/lib/useMusic";
import { CharacterSprite, MonsterSprite } from "@/components/ui/SheetSprite";

/** Title screen: the logo, a boss in the fog, and one thing to press. */
export default function TitlePage() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const destination = useRef<"/dashboard" | "/login">("/login");
  useMusic("title");

  useEffect(() => {
    startRef.current?.focus({ preventScroll: true });
    router.prefetch("/login");
    router.prefetch("/dashboard");
    getBrowserSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) destination.current = "/dashboard";
      })
      .catch(() => undefined);
  }, [router]);

  const start = () => {
    if (leaving) return;
    setLeaving(true);
    playSfx("uiAccept");
    window.setTimeout(() => router.push(destination.current), 320);
  };

  return (
    <main
      className="title-screen font-game fixed inset-0 flex select-none flex-col items-center justify-center overflow-hidden"
      onClick={start}
    >
      <div className="title-fog" aria-hidden="true" />
      <div className="title-fog is-far" aria-hidden="true" />

      <div className="title-boss" aria-hidden="true">
        <MonsterSprite slug="draeven" height={574} />
      </div>

      <div className="relative z-10 flex flex-col items-center px-4 text-center">
        <h1 className="title-logo">SIR, ACTUALLY</h1>
        <p className="g-1 mt-2 text-[var(--ui-orange)]">Research Boss Battle</p>
      </div>

      <button
        ref={startRef}
        type="button"
        data-sfx="none"
        onClick={(event) => {
          event.stopPropagation();
          start();
        }}
        className={`title-start g-2 relative z-10 mt-[12vh] ${leaving ? "is-pressed" : ""}`}
      >
        Tekan Start
      </button>

      <div className="title-hero relative z-10 mt-6" aria-hidden="true">
        <CharacterSprite slug="arka" facing="up" scale={4} walking={false} />
      </div>

      <p className="g-1 absolute bottom-3 left-0 right-0 z-10 text-center text-[var(--ui-cream)] opacity-60">
        © 2026 SIR, ACTUALLY
      </p>

      {leaving ? <div className="title-flash" aria-hidden="true" /> : null}
    </main>
  );
}
