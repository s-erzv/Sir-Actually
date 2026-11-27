"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authJson } from "@/lib/api/client";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { STAGE_LABELS } from "@/lib/labels";
import { useMusic } from "@/lib/useMusic";
import GameMenu, { type MenuEntry } from "@/components/ui/GameMenu";
import { CharacterSprite } from "@/components/ui/SheetSprite";

interface ManuscriptRow {
  id: string;
  title: string;
  stage: keyof typeof STAGE_LABELS;
  language: "id" | "en";
  field: string | null;
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
  /** Short state shown next to the save. */
  state: string;
}

function nextStep(manuscript: ManuscriptRow): NextStep {
  if (!manuscript.map) return { href: "/upload", state: "Belum dibaca" };
  if (manuscript.map.status !== "confirmed" || !manuscript.recon) {
    return { href: `/map/${manuscript.map.id}`, state: "Disiapkan" };
  }
  if (manuscript.recon.status === "done") return { href: `/play/${manuscript.recon.id}`, state: "Siap" };
  return { href: `/findings/${manuscript.recon.id}`, state: "Dianalisis" };
}

type Screen = { kind: "main" } | { kind: "saves" } | { kind: "save"; id: string } | { kind: "delete"; id: string };

/** Main menu: continue, new manuscript, saves, history, how to play, sign out. */
export default function DashboardPage() {
  const router = useRouter();
  const [manuscripts, setManuscripts] = useState<ManuscriptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "main" });
  const [deleteBusy, setDeleteBusy] = useState(false);
  useMusic("camp");

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
        const payload = await authJson<{ manuscripts: ManuscriptRow[] }>("/api/manuscripts/list");
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
    router.replace("/");
  }

  async function confirmDelete(target: ManuscriptRow) {
    if (deleteBusy) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await authJson(`/api/manuscripts/${target.id}`, { method: "DELETE" });
      setManuscripts((current) => current.filter((item) => item.id !== target.id));
      setScreen({ kind: "saves" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus naskah.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const expedition = useMemo(
    () =>
      manuscripts.find((m) => m.map?.status === "confirmed" && m.recon?.status === "done") ??
      manuscripts.find((m) => m.map?.status === "confirmed") ??
      null,
    [manuscripts],
  );

  const selected =
    screen.kind === "save" || screen.kind === "delete"
      ? manuscripts.find((m) => m.id === screen.id) ?? null
      : null;

  useEffect(() => {
    if (screen.kind === "main") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "Backspace") return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea")) return;
      event.preventDefault();
      setScreen((current) =>
        current.kind === "delete" || current.kind === "save" ? { kind: "saves" } : { kind: "main" },
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen.kind]);

  const mainItems: MenuEntry[] = [
    ...(expedition ? [{ key: "continue", label: "Lanjutkan", href: nextStep(expedition).href }] : []),
    { key: "new", label: "Naskah baru", href: "/upload" },
    {
      key: "saves",
      label: "Arsip naskah",
      aside: manuscripts.length,
      disabled: manuscripts.length === 0,
      onSelect: () => setScreen({ kind: "saves" }),
    },
    { key: "history", label: "Riwayat run", href: "/history" },
    { key: "help", label: "Cara main", href: "/tentang" },
    { key: "exit", label: "Keluar", sfx: "uiCancel", onSelect: () => void signOut() },
  ];

  return (
    <main className="font-game flex min-h-[100dvh] items-center justify-center px-4 py-16">
      <div className="grid w-full max-w-[34rem] gap-3">
        {loading ? (
          <div className="ui-box g-1" role="status">
            Membuka arsip...
          </div>
        ) : screen.kind === "main" ? (
          <>
            {expedition ? <ContinueCard manuscript={expedition} /> : null}
            <nav className="ui-box" aria-label="Menu utama">
              <GameMenu key="main" label="Menu utama" items={mainItems} />
            </nav>
          </>
        ) : screen.kind === "saves" ? (
          <section className="ui-box" aria-labelledby="saves-title">
            <h1 id="saves-title" className="g-1 px-1 text-[var(--ui-rust)]">
              Arsip naskah
            </h1>
            <GameMenu
              key="saves"
              label="Arsip naskah"
              items={[
                ...manuscripts.map((manuscript) => ({
                  key: manuscript.id,
                  label: <span className="block truncate">{manuscript.title}</span>,
                  aside: nextStep(manuscript).state,
                  onSelect: () => setScreen({ kind: "save", id: manuscript.id }),
                })),
                { key: "back", label: "Kembali", sfx: "uiCancel" as const, onSelect: () => setScreen({ kind: "main" }) },
              ]}
            />
          </section>
        ) : selected && screen.kind === "save" ? (
          <section className="ui-box" aria-labelledby="save-title">
            <h1 id="save-title" className="g-1 truncate px-1">
              {selected.title}
            </h1>
            <p className="g-1 px-1 text-[var(--ui-rust)]">
              {STAGE_LABELS[selected.stage]} · {selected.findingCount} temuan
            </p>
            <GameMenu
              key={`save-${selected.id}`}
              label="Aksi naskah"
              items={[
                { key: "open", label: "Buka", href: nextStep(selected).href },
                ...(selected.recon
                  ? [{ key: "findings", label: "Lihat temuan", href: `/findings/${selected.recon.id}` }]
                  : []),
                { key: "revise", label: "Unggah revisi", href: `/upload?reviseFrom=${selected.id}` },
                {
                  key: "delete",
                  label: "Hapus",
                  sfx: "uiCancel" as const,
                  onSelect: () => setScreen({ kind: "delete", id: selected.id }),
                },
                { key: "back", label: "Kembali", sfx: "uiCancel" as const, onSelect: () => setScreen({ kind: "saves" }) },
              ]}
            />
          </section>
        ) : selected && screen.kind === "delete" ? (
          <section className="ui-box" role="alertdialog" aria-labelledby="delete-title" aria-describedby="delete-desc">
            <h1 id="delete-title" className="g-1 px-1">
              Hapus &ldquo;{selected.title}&rdquo;?
            </h1>
            <p id="delete-desc" className="g-1 px-1 text-[var(--ui-rust)]">
              Peta, analisis, dan run naskah ini ikut hilang dari arsip.
            </p>
            <GameMenu
              key={`delete-${selected.id}`}
              label="Konfirmasi hapus"
              columns={2}
              items={[
                { key: "no", label: "Tidak", sfx: "uiCancel", onSelect: () => setScreen({ kind: "save", id: selected.id }) },
                {
                  key: "yes",
                  label: deleteBusy ? "Menghapus..." : "Ya, hapus",
                  disabled: deleteBusy,
                  onSelect: () => void confirmDelete(selected),
                },
              ]}
            />
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="ui-box g-1 text-[#a3341f]">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}

/** The save the player most likely wants, like CONTINUE on a cartridge. */
function ContinueCard({ manuscript }: { manuscript: ManuscriptRow }) {
  const step = nextStep(manuscript);
  return (
    <section className="ui-box flex items-center gap-3" aria-label="Naskah terakhir">
      <div className="ui-slot h-16 w-16 shrink-0" aria-hidden="true">
        <CharacterSprite slug="arka" facing="down" scale={3} />
      </div>
      <div className="min-w-0">
        <p className="g-1 truncate">{manuscript.title}</p>
        <p className="g-1 text-[var(--ui-rust)]">
          {manuscript.findingCount} temuan · {step.state}
        </p>
      </div>
    </section>
  );
}
