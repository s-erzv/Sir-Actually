"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { playSfx } from "@/game/audio";
import { useMusic } from "@/lib/useMusic";
import { CharacterSprite } from "@/components/ui/SheetSprite";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useMusic("title");

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
          setMessage("Akun dibuat. Cek email untuk konfirmasi, lalu masuk.");
          return;
        }
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      playSfx("alert");
      setError(err instanceof Error ? err.message : "Gagal masuk.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="font-game relative flex min-h-[100dvh] flex-col items-center justify-center px-4 py-16">
      <Link href="/" data-sfx="uiCancel" className="ui-btn is-quiet absolute left-3 top-3">
        Kembali
      </Link>

      <div className="mb-2" aria-hidden="true">
        <CharacterSprite slug="arka" facing="down" scale={4} />
      </div>

      <section className="ui-box w-full max-w-[26rem]" aria-labelledby="login-title">
        <h1 id="login-title" className="g-2">
          {mode === "login" ? "Masuk" : "Akun baru"}
        </h1>

        <form onSubmit={submit} className="mt-3 space-y-3">
          <label className="block">
            <span className="g-1 block">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@kampus.ac.id"
              className="pixel-input mt-1"
            />
          </label>
          <label className="block">
            <span className="g-1 block">Kata sandi</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="minimal 6 karakter"
              className="pixel-input mt-1"
            />
          </label>

          {error ? (
            <p role="alert" className="g-1 text-[#a3341f]">
              {error}
            </p>
          ) : null}
          {message ? (
            <p role="status" className="g-1 text-[#2f6b3a]">
              {message}
            </p>
          ) : null}

          <button type="submit" disabled={busy} className="ui-btn w-full">
            {busy ? "Memproses..." : mode === "login" ? "Masuk" : "Buat akun"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setMessage(null);
          }}
          className="ui-menu-item mt-2"
        >
          {mode === "login" ? "Belum punya akun? Buat baru" : "Sudah punya akun? Masuk"}
        </button>
      </section>
    </main>
  );
}
