"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { PixelSprite } from "@/components/brand/PixelSprite";
import { authJson } from "@/lib/api/client";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { CLAIM_LABELS, STAGE_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { ClaimKind, ManuscriptStage } from "@/lib/supabase/database";

interface ClaimRow {
  id?: string;
  kind: ClaimKind;
  text: string;
  sourceQuote: string;
}

interface MapPayload {
  manuscript: {
    id: string;
    title: string;
    stage: ManuscriptStage;
    language: "id" | "en";
    min_references: number | null;
  };
  map: {
    id: string;
    version: number;
    status: "draft" | "confirmed";
    completeness: {
      referenceCount: number;
      minReferences: number;
      minReferencesSource: "user" | "default";
      warnings: string[];
    } | null;
    confirmed_at: string | null;
  };
  claims: Array<{
    id: string;
    kind: ClaimKind;
    text: string;
    source_quote: string | null;
    position: number;
  }>;
  citations: Array<{
    id: string;
    raw_text: string;
    verification_status: string;
  }>;
  recon: {
    id: string;
    status: string;
    step: string | null;
    steps_done: number;
    steps_total: number | null;
  } | null;
}

const CLAIM_KINDS = Object.keys(CLAIM_LABELS) as ClaimKind[];

export default function ResearchMapPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [payload, setPayload] = useState<MapPayload | null>(null);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = getBrowserSupabase();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const result = await authJson<MapPayload>(`/api/research-maps/${params.id}`);
      setPayload(result);
      setClaims(
        result.claims.map((claim) => ({
          id: claim.id,
          kind: claim.kind,
          text: claim.text,
          sourceQuote: claim.source_quote ?? "",
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat Research Map.");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateClaim(index: number, patch: Partial<ClaimRow>) {
    setClaims((current) =>
      current.map((claim, claimIndex) => (claimIndex === index ? { ...claim, ...patch } : claim)),
    );
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await authJson(`/api/research-maps/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ claims }),
      });
      setMessage("Draft tersimpan.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function confirmAndRun() {
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      if (!(await save())) return;
      const confirmed = await authJson<{ reconJobId: string | null }>(
        `/api/research-maps/${params.id}/confirm`,
        { method: "POST" },
      );
      if (!confirmed.reconJobId) throw new Error("Job Recon tidak dibuat.");

      let jobId = confirmed.reconJobId;
      for (;;) {
        const run = await authJson<{
          job: {
            id: string;
            status: string;
            step: string | null;
            steps_done: number;
            steps_total: number | null;
            error: string | null;
          };
          done: boolean;
        }>(`/api/recon/${jobId}/run`, { method: "POST" });
        setProgress(
          `Tahap ${run.job.step ?? "-"} · ${run.job.steps_done}/${run.job.steps_total ?? 3}`,
        );
        if (run.job.status === "failed") throw new Error(run.job.error ?? "Recon gagal.");
        if (run.done) {
          router.push(`/findings/${run.job.id}`);
          return;
        }
        jobId = run.job.id;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengonfirmasi Research Map.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="dungeon-bg scanlines grid min-h-screen place-items-center">
        <div className="flex items-center gap-3 text-sm text-ash">
          <span className="h-2 w-2 animate-flicker bg-gold" />
          Membuka Research Map...
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="dungeon-bg scanlines grid min-h-screen place-items-center px-6">
        <div className="pixel-panel max-w-md p-6 text-center">
          <p className="text-sm text-blood">{error ?? "Research Map tidak ditemukan."}</p>
          <Link href="/dashboard" className="pixel-button mt-5 border-ridge text-bone hover:border-gold hover:text-gold">
            Kembali ke arsip
          </Link>
        </div>
      </main>
    );
  }

  const confirmed = payload.map.status === "confirmed";
  const reconId = payload.recon?.id;
  const reconDone = payload.recon?.status === "done";
  const stepProgress = payload.recon?.steps_total
    ? Math.round((payload.recon.steps_done / payload.recon.steps_total) * 100)
    : 0;

  return (
    <main className="dungeon-bg scanlines min-h-screen">
      <header className="sticky top-0 z-30 border-b-2 border-void bg-void/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/dashboard" className="hover:opacity-90">
            <Logo />
          </Link>
          <Link
            href="/dashboard"
            className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ash hover:text-gold"
          >
            Arsip naskah
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <section className="pixel-panel pixel-panel-gold p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`pixel-chip ${confirmed ? "border-moss/40 text-moss" : "border-gold/40 text-gold"}`}>
                  {confirmed ? "Map confirmed" : "Draft"}
                </span>
                <span className="pixel-chip">v{payload.map.version}</span>
                <span className="pixel-chip">{STAGE_LABELS[payload.manuscript.stage]}</span>
                <span className="pixel-chip">{payload.manuscript.language.toUpperCase()}</span>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-bone sm:text-3xl">
                {payload.manuscript.title}
              </h1>
              <p className="mt-2 text-xs leading-6 text-ash">
                Periksa klaim dan kutipan. Konfirmasi membekukan peta ini; revisi naskah
                membuat versi baru.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {reconId && reconDone ? (
                <Link
                  href={`/findings/${reconId}`}
                  className="pixel-button pixel-button-sm border-gold bg-gold text-void hover:bg-bone"
                >
                  Lihat temuan
                </Link>
              ) : null}
              {confirmed && reconId && !reconDone ? (
                <Link
                  href={`/findings/${reconId}`}
                  className="pixel-button pixel-button-sm border-gold bg-gold text-void hover:bg-bone"
                >
                  Progres recon
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-2 border-t border-ridge/60 pt-4 sm:grid-cols-3">
            <Fact label="Klaim" value={String(claims.length)} />
            <Fact label="Referensi" value={String(payload.citations.length)} />
            <Fact
              label="Pedoman referensi"
              value={
                payload.map.completeness
                  ? `${payload.map.completeness.referenceCount} / ${payload.map.completeness.minReferences}`
                  : "—"
              }
            />
          </div>

          {payload.map.completeness?.warnings.length ? (
            <p className="mt-3 border border-gold/30 bg-gold/5 p-2 text-[0.8rem] text-gold">
              Jumlah referensi di bawah pedoman default. Ini peringatan, bukan gerbang keras.
            </p>
          ) : null}

          {reconId && !reconDone && payload.recon ? (
            <div className="mt-4 border border-ridge/60 bg-void/40 p-3">
              <div className="flex items-center justify-between text-[0.72rem] uppercase tracking-[0.14em] text-ash">
                <span>Recon · {payload.recon.status}</span>
                <span>
                  {payload.recon.steps_done}/{payload.recon.steps_total ?? 3}
                </span>
              </div>
              <div className="bar-track mt-2">
                <div className="bar-fill" style={{ width: `${Math.max(4, stepProgress)}%` }} />
              </div>
            </div>
          ) : null}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Peta klaim</p>
                <h2 className="mt-1 text-xl font-bold text-bone">Hasil ekstraksi AI</h2>
              </div>
              {!confirmed ? (
                <button
                  type="button"
                  onClick={() =>
                    setClaims((current) => [
                      ...current,
                      { kind: "problem", text: "", sourceQuote: "" },
                    ])
                  }
                  className="pixel-button pixel-button-sm border-ridge bg-void/60 text-ash hover:border-gold hover:text-gold"
                >
                  + Klaim
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {claims.map((claim, index) => (
                <article key={claim.id ?? index} className="pixel-panel-soft p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center border border-ridge bg-void/60 text-[0.66rem] font-bold text-gold">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <select
                        value={claim.kind}
                        disabled={confirmed}
                        onChange={(event) =>
                          updateClaim(index, { kind: event.target.value as ClaimKind })
                        }
                        className="border border-ridge bg-void/70 px-2 py-1 text-[0.72rem] uppercase tracking-[0.1em] text-bone outline-none focus:border-gold disabled:opacity-50"
                      >
                        {CLAIM_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {CLAIM_LABELS[kind]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!confirmed ? (
                      <button
                        type="button"
                        onClick={() =>
                          setClaims((current) =>
                            current.filter((_, claimIndex) => claimIndex !== index),
                          )
                        }
                        className="text-[0.72rem] uppercase tracking-[0.12em] text-ash hover:text-blood"
                      >
                        Hapus
                      </button>
                    ) : null}
                  </div>

                  <textarea
                    value={claim.text}
                    disabled={confirmed}
                    rows={2}
                    onChange={(event) => updateClaim(index, { text: event.target.value })}
                    className="pixel-input mt-3 resize-y disabled:opacity-60"
                  />
                  <textarea
                    value={claim.sourceQuote}
                    disabled={confirmed}
                    rows={2}
                    placeholder="Kutipan persis dari naskah"
                    onChange={(event) => updateClaim(index, { sourceQuote: event.target.value })}
                    className="pixel-input mt-2 resize-y text-sm text-ash disabled:opacity-50"
                  />
                </article>
              ))}

              {claims.length === 0 ? (
                <p className="pixel-panel-soft p-4 text-sm text-ash">
                  Tidak ada klaim. Tambahkan manual sebelum konfirmasi.
                </p>
              ) : null}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="pixel-panel-soft p-4">
              <div className="flex items-center justify-between border-b border-ridge/60 pb-3">
                <div>
                  <p className="eyebrow">Daftar pustaka</p>
                  <p className="mt-1 text-sm font-bold text-bone">{payload.citations.length} entri</p>
                </div>
                <PixelSprite kind="scroll" size={28} />
              </div>
              <p className="mt-3 text-[0.72rem] leading-5 text-ash">
                Verifikasi berjalan setelah konfirmasi. Referensi yang tidak ditemukan tidak
                otomatis dianggap palsu.
              </p>
              <ol className="mt-3 max-h-[28rem] space-y-2 overflow-auto pr-1">
                {payload.citations.map((citation, index) => (
                  <li key={citation.id} className="border border-ridge/50 bg-void/40 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[0.66rem] uppercase tracking-[0.14em] text-ash">
                        [{String(index + 1).padStart(2, "0")}]
                      </span>
                      <span className={`text-[0.66rem] uppercase tracking-[0.12em] ${statusTone(citation.verification_status)}`}>
                        {STATUS_LABELS[citation.verification_status] ?? citation.verification_status}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.8rem] leading-5 text-ash/90">{citation.raw_text}</p>
                  </li>
                ))}
              </ol>
              {payload.citations.length === 0 ? (
                <p className="mt-3 text-xs text-ember">Daftar pustaka kosong. Konfirmasi akan ditolak.</p>
              ) : null}
            </section>

            <section className="border border-ridge/60 bg-void/40 p-4">
              <p className="font-pixel text-[0.58rem] text-gold">Aturan peta</p>
              <ul className="mt-3 space-y-2 text-[0.8rem] leading-5 text-ash">
                <li>Kutipan harus persis ada di naskah.</li>
                <li>Klaim di peta confirmed tidak bisa diubah.</li>
                <li>Sitasi confirmed hanya boleh menerima sisipan Ghost.</li>
              </ul>
            </section>
          </aside>
        </div>

        {error ? <p className="mt-6 border border-blood/40 bg-blood/10 p-3 text-sm text-blood">{error}</p> : null}
        {message ? <p className="mt-6 border border-moss/40 bg-moss/10 p-3 text-sm text-moss">{message}</p> : null}
        {progress ? (
          <div className="mt-4 border border-gold/30 bg-gold/5 p-3 text-xs text-gold">
            <div className="flex items-center justify-between">
              <span>Recon berjalan</span>
              <span className="animate-flicker">●</span>
            </div>
            <p className="mt-1 text-ash">{progress}</p>
          </div>
        ) : null}

        {!confirmed ? (
          <div className="sticky bottom-3 z-20 mt-8 border-2 border-void bg-[#0a0f14]/95 p-3 shadow-[inset_0_0_0_1px_#34424e,5px_5px_0_rgba(0,0,0,0.4)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[0.72rem] uppercase tracking-[0.14em] text-ash">
                {claims.length} klaim · {payload.citations.length} referensi
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving || busy}
                  className="pixel-button pixel-button-sm border-ridge bg-void/60 text-bone hover:border-gold hover:text-gold"
                >
                  {saving ? "Menyimpan..." : "Simpan draft"}
                </button>
                <button
                  type="button"
                  onClick={() => void confirmAndRun()}
                  disabled={saving || busy || claims.length === 0}
                  className="pixel-button pixel-button-sm border-gold bg-gold text-void hover:bg-bone"
                >
                  {busy ? "Menjalankan Recon..." : "Konfirmasi dan analisis"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-ridge/50 bg-void/40 px-3 py-2">
      <p className="text-[0.66rem] uppercase tracking-[0.16em] text-ash">{label}</p>
      <p className="mt-1 text-sm font-bold text-bone">{value}</p>
    </div>
  );
}

function statusTone(status: string): string {
  if (status === "verified") return "text-moss";
  if (status === "not_found") return "text-blood";
  if (status === "mismatch") return "text-ember";
  if (status === "needs_review") return "text-gold";
  return "text-ash";
}
