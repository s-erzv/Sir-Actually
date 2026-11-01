"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { PixelSprite } from "@/components/brand/PixelSprite";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = getBrowserSupabase();
      if (mode === "signup") {
        const { data, error: signupError } = await supabase.auth.signUp({ email, password });
        if (signupError) throw signupError;
        if (!data.session) {
          setMessage("Akun dibuat. Cek email untuk konfirmasi, lalu login.");
          return;
        }
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="dungeon-bg scanlines flex min-h-screen flex-col">
      <header className="border-b-2 border-void bg-void/90">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="hover:opacity-90">
            <Logo tagline />
          </Link>
          <Link
            href="/"
            className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ash hover:text-gold"
          >
            Kembali ke gerbang
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:py-20">
        <section className="order-2 lg:order-1">
          <p className="eyebrow">Save file</p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-tight text-bone sm:text-5xl">
            Masuk ke
            <br />
            <span className="text-gold">dungeon.</span>
          </h1>
          <p className="mt-5 max-w-md text-[0.95rem] leading-7 text-ash">
            Naskah disimpan per akun. Satu akun, satu arsip naskah, satu
            perjalanan untuk mempertanggungjawabkan setiap klaim.
          </p>

          <div className="game-screen mt-8 max-w-md">
            <div className="game-screen-bar flex items-center justify-between px-3 py-2">
              <span className="font-pixel text-[0.58rem] text-gold">Save point 01</span>
              <span className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-moss">
                <span className="h-2 w-2 bg-moss" />
                Siap
              </span>
            </div>
            <div className="tile-floor relative h-40 overflow-hidden">
              <div className="wall-stone absolute inset-x-0 top-0 h-7 border-b-2 border-void" />
              <div className="wall-stone absolute inset-x-0 bottom-0 h-6 border-t-2 border-void" />
              <span className="torch-flame absolute left-5 top-10" />
              <span className="torch-flame absolute right-5 top-10" />
              <PixelSprite
                kind="hero"
                size={76}
                className="absolute bottom-5 left-[22%] drop-shadow-[0_5px_0_rgba(0,0,0,0.45)]"
              />
              <PixelSprite
                kind="chest"
                size={62}
                className="absolute bottom-5 right-[19%] drop-shadow-[0_5px_0_rgba(0,0,0,0.45)]"
              />
            </div>
            <div className="grid grid-cols-3 border-t-2 border-void bg-[#111920]">
              <SaveStat label="Slot" value="01" />
              <SaveStat label="Nyawa" value="♥ ♥ ♥" tone="text-blood" />
              <SaveStat label="Level" value="01" tone="text-gold" />
            </div>
          </div>
        </section>

        <section className="order-1 lg:order-2">
          <div className="pixel-panel pixel-panel-gold mx-auto w-full max-w-md p-5 sm:p-7">
            <div className="flex items-center justify-between gap-4 border-b-2 border-void pb-4">
              <div>
                <p className="font-pixel text-[0.58rem] text-gold">
                  {mode === "login" ? "Resume run" : "New save"}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-bone">
                  {mode === "login" ? "Masuk" : "Buat akun"}
                </h2>
              </div>
              <span className="grid h-12 w-12 place-items-center border-2 border-void bg-tomb">
                <LogoMark size={30} />
              </span>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block">
                <span className="pixel-label">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@kampus.ac.id"
                  className="pixel-input"
                />
              </label>
              <label className="block">
                <span className="pixel-label">Password</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="minimal 6 karakter"
                  className="pixel-input"
                />
              </label>

              <button
                type="submit"
                disabled={busy}
                className="pixel-button w-full border-gold bg-gold text-void hover:bg-bone"
              >
                {busy ? "Memproses..." : mode === "login" ? "Masuk dungeon" : "Buat save file"}
              </button>
            </form>

            {error ? (
              <p className="mt-4 border-2 border-void bg-blood/15 p-3 text-sm leading-6 text-blood">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="mt-4 border-2 border-void bg-moss/15 p-3 text-sm leading-6 text-moss">
                {message}
              </p>
            ) : null}

            <div className="mt-5 border-t-2 border-void pt-4">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError(null);
                  setMessage(null);
                }}
                className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-ash hover:text-gold"
              >
                {mode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
              </button>
            </div>
          </div>

          <p className="mx-auto mt-4 max-w-md text-center text-[0.7rem] leading-5 text-ash/75">
            Jangan gunakan email orang lain. Naskah dan hasil analisis terikat ke akun ini.
          </p>
        </section>
      </div>

      <footer className="border-t-2 border-void">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-ash/60 sm:px-8">
          <span>Sir, Actually · Research boss battle</span>
          <span className="text-ridge">Gerbang dungeon</span>
        </div>
      </footer>
    </main>
  );
}

function SaveStat({ label, value, tone = "text-bone" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="border-r-2 border-void px-2 py-2 text-center last:border-r-0">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-ash">{label}</p>
      <p className={`mt-1 text-[0.78rem] font-bold ${tone}`}>{value}</p>
    </div>
  );
}
