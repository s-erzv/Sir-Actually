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
  recon: { id: string; status: string } | null;
}

interface NextStep {
  href: string;
  label: string;
  hint: string;
  primary: boolean;
}

function nextStep(manuscript: ManuscriptRow): NextStep {
  if (!manuscript.map) {
    return {
      href: "/upload",
      label: "Tempa naskah",
      hint: "Peta belum dibentuk",
      primary: false,
    };
  }
  if (manuscript.map.status !== "confirmed") {
    return {
      href: `/map/${manuscript.map.id}`,
      label: "Buka peta",
      hint: "Peta dikunci otomatis sebelum dungeon dibuka",
      primary: true,
    };
  }
  if (!manuscript.recon) {
    return {
      href: `/map/${manuscript.map.id}`,
      label: "Buka peta",
      hint: "Recon belum dijalankan",
      primary: false,
    };
  }
  if (manuscript.recon.status === "done") {
    return {
      href: `/play/${manuscript.recon.id}`,
      label: "Turun ke dungeon",
      hint: "Pilih karakter lalu masuk",
      primary: true,
    };
  }
  return {
    href: `/findings/${manuscript.recon.id}`,
    label: "Lihat recon",
    hint: "Analisis sedang berjalan",
    primary: false,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [manuscripts, setManuscripts] = useState<ManuscriptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManuscriptRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await authJson(`/api/manuscripts/${deleteTarget.id}`, { method: "DELETE" });
      setManuscripts((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Gagal menghapus naskah.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const stats = useMemo(() => {
    const ready = manuscripts.filter((m) => m.recon?.status === "done").length;
    const findings = manuscripts.reduce((sum, m) => sum + m.findingCount, 0);
    return { ready, findings };
  }, [manuscripts]);

  const expedition = useMemo(() => {
    return (
      manuscripts.find((m) => m.map?.status === "confirmed" && m.recon?.status === "done") ??
      manuscripts.find((m) => m.map?.status === "confirmed") ??
      null
    );
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
              Naskah baru
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
            <p className="eyebrow">Kamp ekspedisi</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-bone sm:text-5xl">
              Pilih save file.
            </h1>
            <p className="mt-2 text-sm text-ash">{email ?? "Memuat sesi..."}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Naskah" value={String(manuscripts.length)} />
            <MiniStat label="Siap turun" value={String(stats.ready)} tone="text-moss" />
            <MiniStat label="Temuan" value={String(stats.findings)} tone="text-mana" />
          </div>
        </div>

        {loading ? (
          <div className="mt-12 flex items-center gap-3 text-sm text-ash">
            <span className="h-2 w-2 animate-flicker bg-gold" />
            Membuka arsip...
          </div>
        ) : manuscripts.length === 0 ? (
          <section className="pixel-panel mt-10 p-6 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="font-pixel text-[0.6rem] text-gold">Save slot kosong</p>
                <h2 className="mt-2 text-2xl font-bold text-bone">Belum ada ekspedisi.</h2>
                <p className="mt-2 max-w-lg text-sm leading-7 text-ash">
                  Unggah DOCX atau PDF berteks. AI menyusun Research Map dari klaim
                  dan daftar pustaka, lalu dungeon pertama dibuka.
                </p>
                <Link
                  href="/upload"
                  className="pixel-button mt-5 border-gold bg-gold text-void hover:bg-bone"
                >
                  Tempa naskah pertama
                </Link>
              </div>
              <div className="hidden h-32 w-32 place-items-center border-2 border-void bg-[#0a0f14] sm:grid">
                <PixelSprite kind="chest" size={82} />
              </div>
            </div>
          </section>
        ) : (
          <>
            {expedition ? (
              <ExpeditionBanner manuscript={expedition} />
            ) : (
              <div className="mt-8 flex flex-wrap items-center gap-4 border-y-2 border-void bg-tomb/55 px-4 py-3">
                <PixelSprite kind="key" size={36} />
                <p className="min-w-0 flex-1 text-sm leading-6 text-ash">
                  Belum ada peta terkunci. Pilih save file di bawah untuk membuka
                  denah dan mulai ekspedisi.
                </p>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between gap-3">
              <p className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-ash">
                Semua save file
              </p>
              <Link
                href="/upload"
                className="text-[0.68rem] font-bold uppercase tracking-[0.07em] text-gold hover:text-bone"
              >
                + Tempa naskah
              </Link>
            </div>

            <div className="mt-3 space-y-3">
              {manuscripts.map((manuscript, index) => (
                <ManuscriptCard
                  key={manuscript.id}
                  manuscript={manuscript}
                  index={index}
                  onDelete={() => {
                    setDeleteError(null);
                    setDeleteTarget(manuscript);
                  }}
                />
              ))}
            </div>
          </>
        )}

        {error ? (
          <p className="mt-8 border-2 border-void bg-blood/15 p-3 text-sm leading-6 text-blood">
            {error}
          </p>
        ) : null}

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t-2 border-void pt-4 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-ash/60">
          <span>Setiap klaim menunggu pertanggungjawaban.</span>
          <Link href="/" className="hover:text-gold">
            Kembali ke gerbang
          </Link>
        </div>
      </div>

      {deleteTarget ? (
        <div
          className="game-fade fixed inset-0 z-50 grid place-items-center bg-[#05080b]/90 px-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Hapus naskah"
        >
          <div className="game-screen-in w-full max-w-sm border-2 border-blood/70 bg-[#0a0f14] p-5 shadow-[8px_8px_0_#05080b]">
            <p className="font-pixel text-[0.56rem] text-blood">HAPUS SAVE</p>
            <h2 className="mt-2 text-xl font-bold text-bone">Hapus naskah ini?</h2>
            <p className="mt-2 truncate text-sm text-ash">{deleteTarget.title}</p>
            <p className="mt-3 text-[0.78rem] leading-5 text-ash">
              Peta, Recon, dan run naskah ini ikut disembunyikan dari arsip.
              Tindakan ini tidak bisa dibatalkan lewat UI.
            </p>
            {deleteError ? (
              <p className="mt-3 border border-blood/40 bg-blood/10 p-2 text-xs text-blood">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusy}
                className="pixel-button pixel-button-sm border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleteBusy}
                className="pixel-button pixel-button-sm border-blood bg-blood text-void hover:bg-ember"
              >
                {deleteBusy ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ExpeditionBanner({ manuscript }: { manuscript: ManuscriptRow }) {
  const step = nextStep(manuscript);
  const ready = manuscript.recon?.status === "done";

  return (
    <section className="game-screen-in pixel-panel pixel-panel-gold relative mt-8 overflow-hidden">
      <div className="absolute inset-y-0 right-0 hidden w-56 border-l-2 border-void bg-[#0a0f14] sm:block" aria-hidden="true">
        <div className="tile-floor absolute inset-0 opacity-70" />
        <div className="absolute inset-x-0 top-0 h-6 wall-stone" />
        <div className="absolute inset-x-0 bottom-0 h-6 wall-stone" />
        <span className="torch-flame absolute left-6 top-12" />
        <span className="torch-flame absolute right-6 top-12" />
        <PixelSprite
          kind={ready ? "sir" : "scroll"}
          size={120}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 drop-shadow-[0_6px_0_rgba(0,0,0,0.5)]"
        />
      </div>

      <div className="relative p-5 sm:p-7 sm:pr-64">
        <p className="font-pixel text-[0.58rem] text-gold">
          {ready ? "Ekspedisi siap" : "Ekspedisi berjalan"}
        </p>
        <h2 className="mt-2 max-w-md truncate text-2xl font-bold tracking-tight text-bone">
          {manuscript.title}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-ash">
          {ready
            ? `${manuscript.findingCount} temuan sudah jadi ruang. Pilih karakter, lalu turun ke dungeon.`
            : step.hint}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[0.62rem] font-bold uppercase tracking-[0.08em]">
          <span className="border border-ridge/70 bg-void/60 px-2 py-1 text-moss">Peta terkunci</span>
          <span className={`border px-2 py-1 ${ready ? "border-moss/60 bg-moss/10 text-moss" : "border-gold/50 bg-gold/10 text-gold"}`}>
            {ready ? "Recon selesai" : "Recon"}
          </span>
          <span className={`border px-2 py-1 ${ready ? "border-gold/50 bg-gold/10 text-gold" : "border-ridge/70 bg-void/60 text-ash/60"}`}>
            Dungeon
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={step.href}
            className="pixel-button border-gold bg-gold text-void hover:bg-bone"
          >
            {step.label} <span aria-hidden="true">→</span>
          </Link>
          {manuscript.recon ? (
            <Link
              href={`/findings/${manuscript.recon.id}`}
              className="pixel-button border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold"
            >
              Lihat temuan
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ManuscriptCard({
  manuscript,
  index,
  onDelete,
}: {
  manuscript: ManuscriptRow;
  index: number;
  onDelete: () => void;
}) {
  const confirmed = manuscript.map?.status === "confirmed";
  const reconDone = manuscript.recon?.status === "done";
  const step = nextStep(manuscript);
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
        <PixelSprite kind={reconDone ? "sir" : "scroll"} size={reconDone ? 48 : 38} />
        <span
          className={`h-1.5 w-1.5 ${reconDone ? "animate-flicker bg-moss" : confirmed ? "bg-gold" : "bg-ridge"}`}
          aria-hidden="true"
        />
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
                {confirmed ? "Peta terkunci" : manuscript.map ? "Peta draft" : "Belum ditempa"}
              </span>
              <span className={reconDone ? "text-moss" : "text-ash"}>
                {reconDone ? "Recon selesai" : manuscript.recon ? "Recon berjalan" : "Recon menunggu"}
              </span>
              <span className="text-ash">{manuscript.findingCount} temuan</span>
              {manuscript.map ? (
                <span className="text-ash">Map v{manuscript.map.version}</span>
              ) : null}
            </div>

            <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((slot) => {
                const state =
                  slot === 0
                    ? confirmed
                      ? "done"
                      : "active"
                    : slot === 1
                      ? reconDone
                        ? "done"
                        : manuscript.recon
                          ? "active"
                          : "todo"
                      : reconDone
                        ? "active"
                        : "todo";
                return (
                  <span
                    key={slot}
                    className={`h-2 flex-1 border border-void ${
                      state === "done"
                        ? "bg-moss"
                        : state === "active"
                          ? "bg-gold"
                          : "bg-ridge/50"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {manuscript.map ? (
              <Link
                href={`/map/${manuscript.map.id}`}
                className="pixel-button pixel-button-sm border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold"
              >
                {confirmed ? "Lihat peta" : "Buka peta"}
              </Link>
            ) : null}
            <Link
              href={step.href}
              className={`pixel-button pixel-button-sm ${
                step.primary
                  ? "border-gold bg-gold text-void hover:bg-bone"
                  : "border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold"
              }`}
            >
              {step.label}
            </Link>
            <button
              type="button"
              onClick={onDelete}
              className="pixel-button pixel-button-sm border-ridge bg-void/40 text-ash hover:border-blood hover:text-blood"
              aria-label={`Hapus naskah ${manuscript.title}`}
            >
              Hapus
            </button>
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
