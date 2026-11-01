"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { PixelSprite } from "@/components/brand/PixelSprite";
import { authJson } from "@/lib/api/client";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { STAGE_LABELS } from "@/lib/labels";

interface ManuscriptRow {
  id: string;
  title: string;
  stage: keyof typeof STAGE_LABELS;
  language: "id" | "en";
  field: string | null;
  min_references: number | null;
  created_at: string;
  findingCount: number;
  map: {
    id: string;
    version: number;
    status: "draft" | "confirmed";
    confirmed_at: string | null;
  } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [manuscripts, setManuscripts] = useState<ManuscriptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supabase = getBrowserSupabase();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.replace("/login");
          return;
        }
        if (cancelled) return;
        setEmail(data.session.user.email ?? null);
        const payload = await authJson<{ manuscripts: ManuscriptRow[] }>(
          "/api/manuscripts/list",
        );
        if (!cancelled) setManuscripts(payload.manuscripts);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function signOut() {
    await getBrowserSupabase().auth.signOut();
    router.replace("/login");
  }

  const stats = useMemo(() => {
    const confirmed = manuscripts.filter((m) => m.map?.status === "confirmed").length;
    const findings = manuscripts.reduce((sum, m) => sum + m.findingCount, 0);
    return { confirmed, findings };
  }, [manuscripts]);

  return (
    <main className="dungeon-bg scanlines min-h-screen">
      <header className="sticky top-0 z-30 border-b-2 border-void bg-void/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="hover:opacity-90">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/upload"
              className="pixel-button pixel-button-sm border-gold bg-gold text-void hover:bg-bone"
            >
              Unggah naskah
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="pixel-button pixel-button-sm border-ridge bg-tomb/80 text-ash hover:border-blood hover:text-blood"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Kamp</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-bone sm:text-5xl">
              Arsip naskah.
            </h1>
            <p className="mt-2 text-sm text-ash">{email ?? "Memuat sesi..."}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Naskah" value={String(manuscripts.length)} />
            <MiniStat label="Terkunci" value={String(stats.confirmed)} tone="text-moss" />
            <MiniStat label="Temuan" value={String(stats.findings)} tone="text-mana" />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4 border-y-2 border-void bg-tomb/55 px-4 py-3">
          <PixelSprite kind="key" size={36} />
          <p className="min-w-0 flex-1 text-sm leading-6 text-ash">
            Satu naskah, satu save file. Konfirmasi Research Map untuk membuka
            dungeon dan mengunci klaim yang siap diuji.
          </p>
          <Link
            href="/upload"
            className="text-[0.7rem] font-bold uppercase tracking-[0.07em] text-gold hover:text-bone"
          >
            + Naskah baru
          </Link>
        </div>

        {error ? (
          <p className="mt-8 border-2 border-void bg-blood/15 p-3 text-sm leading-6 text-blood">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-12 flex items-center gap-3 text-sm text-ash">
            <span className="h-2 w-2 animate-flicker bg-gold" />
            Memuat arsip...
          </div>
        ) : manuscripts.length === 0 ? (
          <section className="pixel-panel mt-10 p-6 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="font-pixel text-[0.6rem] text-gold">Slot kosong</p>
                <h2 className="mt-2 text-2xl font-bold text-bone">Belum ada naskah.</h2>
                <p className="mt-2 max-w-lg text-sm leading-7 text-ash">
                  Unggah DOCX atau PDF berteks. AI akan menyusun Research Map dari
                  klaim dan daftar pustaka, lalu kamu konfirmasi sebelum dungeon
                  dibuka.
                </p>
                <Link
                  href="/upload"
                  className="pixel-button mt-5 border-gold bg-gold text-void hover:bg-bone"
                >
                  Unggah naskah pertama
                </Link>
              </div>
              <div className="hidden h-32 w-32 place-items-center border-2 border-void bg-[#0a0f14] sm:grid">
                <PixelSprite kind="chest" size={82} />
              </div>
            </div>
          </section>
        ) : (
          <div className="mt-9 space-y-3">
            {manuscripts.map((manuscript, index) => (
              <ManuscriptCard key={manuscript.id} manuscript={manuscript} index={index} />
            ))}
          </div>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t-2 border-void pt-4 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-ash/60">
          <span>Setiap klaim menunggu pertanggungjawaban.</span>
          <Link href="/" className="hover:text-gold">
            Kembali ke gerbang
          </Link>
        </div>
      </div>
    </main>
  );
}

function ManuscriptCard({ manuscript, index }: { manuscript: ManuscriptRow; index: number }) {
  const confirmed = manuscript.map?.status === "confirmed";
  const created = new Date(manuscript.created_at).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <article className="pixel-panel-soft group flex overflow-hidden">
      <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center gap-2 border-r-2 border-void bg-[#0a0f14] px-2 py-4 sm:w-24">
        <span className="font-pixel text-[0.6rem] text-ash">
          {String(index + 1).padStart(2, "0")}
        </span>
        <PixelSprite kind="scroll" size={38} />
      </div>

      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="pixel-chip">{STAGE_LABELS[manuscript.stage]}</span>
              <span className="pixel-chip">{manuscript.language.toUpperCase()}</span>
              {manuscript.field ? <span className="pixel-chip">{manuscript.field}</span> : null}
            </div>

            <h2 className="mt-3 truncate text-xl font-bold tracking-tight text-bone group-hover:text-gold">
              {manuscript.title}
            </h2>
            <p className="mt-1 text-[0.7rem] font-bold uppercase tracking-[0.06em] text-ash/75">
              Ditambahkan {created}
              {manuscript.min_references ? ` · min. ${manuscript.min_references} referensi` : ""}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.66rem] font-bold uppercase tracking-[0.07em]">
              <span className={confirmed ? "text-moss" : "text-gold"}>
                {confirmed ? "Map terkunci" : manuscript.map ? "Map draft" : "Belum ditempa"}
              </span>
              <span className="text-ash">{manuscript.findingCount} temuan</span>
              {manuscript.map ? (
                <span className="text-ash">Research Map v{manuscript.map.version}</span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {manuscript.map ? (
              <Link
                href={`/map/${manuscript.map.id}`}
                className="pixel-button pixel-button-sm border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold"
              >
                {confirmed ? "Lihat peta" : "Konfirmasi peta"}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function MiniStat({ label, value, tone = "text-gold" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="border-2 border-void bg-tomb/60 px-3 py-2 text-center shadow-[inset_0_0_0_1px_#34424e]">
      <p className={`font-pixel text-lg font-bold leading-none ${tone}`}>{value}</p>
      <p className="mt-2 text-[0.6rem] font-bold uppercase tracking-[0.07em] text-ash">
        {label}
      </p>
    </div>
  );
}
