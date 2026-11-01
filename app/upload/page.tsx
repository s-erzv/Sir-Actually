"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { PixelSprite } from "@/components/brand/PixelSprite";
import QuestPath from "@/components/game/QuestPath";
import ReadingOverlay from "@/components/manuscript/ReadingOverlay";
import { authJson } from "@/lib/api/client";
import { extractManuscriptText } from "@/lib/manuscript/extract";
import { getBrowserSupabase } from "@/lib/supabase/browser";

interface UploadResponse {
  manuscriptId: string;
  researchMapId: string;
  claimCount: number;
  citationCount: number;
  discardedQuotes: number;
  embeddingWarning: string | null;
}

export default function UploadPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [field, setField] = useState("");
  const [stage, setStage] = useState<"proposal" | "skripsi" | "jurnal">("skripsi");
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [minReferences, setMinReferences] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getBrowserSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!data.session) {
          router.replace("/login");
          return;
        }
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function pickFile(file: File | null) {
    if (!file) return;
    setError(null);
    setExtracting(true);
    setFileName(file.name);
    try {
      if (file.size > 15 * 1024 * 1024) {
        throw new Error("File lebih dari 15 MB. Kompres atau gunakan naskah tanpa gambar besar.");
      }
      const text = await extractManuscriptText(file);
      if (text.length > 800_000) {
        throw new Error("Teks naskah lebih dari 800.000 karakter. Pecah atau ringkas naskah.");
      }
      setSourceText(text);
      if (!title.trim()) setTitle(file.name.replace(/\.(docx|pdf|txt|md)$/i, ""));
    } catch (err) {
      setSourceText("");
      setError(err instanceof Error ? err.message : "Gagal membaca file.");
    } finally {
      setExtracting(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMissing([]);
    try {
      if (!privacyAccepted) {
        throw new Error("Centang persetujuan pengiriman naskah ke penyedia LLM.");
      }
      if (sourceText.length < 300) {
        throw new Error("Naskah terlalu pendek atau belum diekstrak.");
      }
      const payload = await authJson<UploadResponse>("/api/manuscripts", {
        method: "POST",
        body: JSON.stringify({
          title,
          field: field.trim() || null,
          language,
          stage,
          minReferences: minReferences.trim() ? Number(minReferences) : null,
          sourceText,
        }),
      });
      router.push(`/map/${payload.researchMapId}`);
    } catch (err) {
      const body = (err as { body?: { missing?: string[] } }).body;
      if (body?.missing?.length) setMissing(body.missing);
      setError(err instanceof Error ? err.message : "Gagal mengunggah naskah.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <main className="dungeon-bg scanlines grid min-h-screen place-items-center">
        <div className="flex items-center gap-3 text-sm text-ash">
          <span className="h-2 w-2 animate-flicker bg-gold" />
          Membuka gerbang...
        </div>
      </main>
    );
  }

  const textReady = sourceText.length >= 300;
  const progress = Math.min(100, Math.round((sourceText.length / 800_000) * 100));

  return (
    <main className="dungeon-bg scanlines min-h-screen">
      {busy ? <ReadingOverlay fileName={fileName} /> : null}

      <header className="border-b-2 border-void bg-void/90">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/dashboard" className="hover:opacity-90">
            <Logo />
          </Link>
          <Link
            href="/dashboard"
            className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ash hover:text-gold"
          >
            Kembali ke arsip
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <QuestPath current="manuscript" className="mb-8" />

        <div className="max-w-2xl">
          <p className="eyebrow">Pos 01 · Forge naskah</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-bone sm:text-5xl">
            Tempa naskah
            <br />
            <span className="text-gold">jadi dungeon.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[0.95rem] leading-7 text-ash">
            Naskah dibaca di browser. Teks dikirim ke server dan penyedia LLM untuk
            ekstraksi Research Map. Jangan unggah naskah yang tidak boleh diproses
            pihak ketiga.
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
          <section className="pixel-panel p-4 sm:p-6">
            <div className="flex items-center justify-between border-b-2 border-void pb-4">
              <div>
                <p className="font-pixel text-[0.6rem] text-gold">Input naskah</p>
                <h2 className="mt-2 text-xl font-bold text-bone">Data manuskrip</h2>
              </div>
              <span className="pixel-chip border-gold/30 text-gold">Ruang 01 / 03</span>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="pixel-label">Judul</span>
                <input
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Judul naskah"
                  className="pixel-input"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="pixel-label">Bidang</span>
                  <input
                    value={field}
                    onChange={(event) => setField(event.target.value)}
                    placeholder="mis. pendidikan"
                    className="pixel-input"
                  />
                </label>
                <label className="block">
                  <span className="pixel-label">Tahap</span>
                  <select
                    value={stage}
                    onChange={(event) => setStage(event.target.value as typeof stage)}
                    className="pixel-input"
                  >
                    <option value="proposal">Proposal</option>
                    <option value="skripsi">Skripsi</option>
                    <option value="jurnal">Artikel jurnal</option>
                  </select>
                </label>
                <label className="block">
                  <span className="pixel-label">Bahasa naskah</span>
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as typeof language)}
                    className="pixel-input"
                  >
                    <option value="id">Indonesia</option>
                    <option value="en">Inggris</option>
                  </select>
                </label>
                <label className="block">
                  <span className="pixel-label">Minimal referensi</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={minReferences}
                    onChange={(event) => setMinReferences(event.target.value)}
                    placeholder="opsional"
                    className="pixel-input"
                  />
                </label>
              </div>

              <div>
                <span className="pixel-label">File naskah</span>
                <label className="group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden border-2 border-dashed border-ridge bg-[#0a0f14] px-4 py-8 text-center transition-colors hover:border-gold/70 hover:bg-[#111920]">
                  <input
                    type="file"
                    accept=".docx,.pdf,.txt,.md"
                    onChange={(event) => void pickFile(event.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                  <PixelSprite kind="scroll" size={58} className="animate-bob" />
                  <span className="mt-3 text-sm font-bold text-bone">
                    {extracting ? "Mengonversi naskah..." : "Pilih atau jatuhkan naskah"}
                  </span>
                  <span className="mt-1 text-[0.66rem] font-bold uppercase tracking-[0.07em] text-ash">
                    DOCX · PDF berteks · TXT · MD → Markdown · maks. 15 MB
                  </span>
                </label>
              </div>

              <div className="border-2 border-void bg-tomb/50 p-3 text-xs leading-5 text-ash">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {extracting
                      ? "Membaca file..."
                      : fileName
                        ? `${fileName} · ${sourceText.length.toLocaleString("id-ID")} karakter`
                        : "Belum ada file."}
                  </span>
                  <span className={textReady ? "text-moss" : "text-ash"}>
                    {textReady ? "Siap ditempa" : "Butuh ≥ 300 karakter"}
                  </span>
                </div>
                <div className="bar-track mt-2">
                  <div className="bar-fill" style={{ width: `${Math.max(2, progress)}%` }} />
                </div>
                {sourceText ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[0.72rem] uppercase tracking-[0.14em] text-ash hover:text-gold">
                      Lihat Markdown kanonik
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[0.8rem] leading-5 text-ash/80">
                      {sourceText.slice(0, 4000)}
                      {sourceText.length > 4000 ? "\n\n[...]" : ""}
                    </pre>
                  </details>
                ) : null}
              </div>

              <label className="flex items-start gap-3 border border-ridge/60 bg-void/40 p-3 text-xs leading-5 text-ash">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(event) => setPrivacyAccepted(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#f0c05a]"
                />
                <span>
                  Saya paham teks naskah dikirim ke penyedia LLM yang dikonfigurasi dan
                  disimpan di Supabase.
                </span>
              </label>

              {error ? (
                <p className="border border-blood/40 bg-blood/10 p-3 text-sm text-blood">{error}</p>
              ) : null}
              {missing.length > 0 ? (
                <div className="border border-ember/40 bg-ember/10 p-3 text-xs text-ember">
                  <p className="font-bold uppercase tracking-[0.12em]">Bagian yang kurang:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={busy || extracting || !textReady}
                className="pixel-button w-full border-gold bg-gold text-void hover:bg-bone"
              >
                {busy ? "AI membaca naskah..." : "Ekstrak Research Map"}
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="pixel-panel-soft p-4">
              <p className="font-pixel text-[0.6rem] text-gold">Yang terjadi</p>
              <ol className="mt-4 space-y-4">
                <RitualStep n="01" title="Baca" body="Teks diekstrak lokal, lalu dikirim ke LLM." />
                <RitualStep n="02" title="Petakan" body="Klaim dan daftar pustaka dipisah." />
                <RitualStep n="03" title="Kunci" body="Peta dikunci otomatis; langsung jadi dungeon." />
              </ol>
            </div>

            <div className="pixel-panel-soft p-4">
              <div className="flex items-center justify-between border-b-2 border-void pb-3">
                <span className="font-pixel text-[0.58rem] text-ash">Peringatan</span>
                <span className="font-pixel text-[0.7rem] text-ember">!</span>
              </div>
              <ul className="mt-3 space-y-2 text-[0.8rem] leading-5 text-ash">
                <li>PDF hasil scan tanpa teks tidak bisa dibaca.</li>
                <li>Naskah kurang bagian akan ditolak sebelum AI dipanggil.</li>
                <li>Jumlah referensi di bawah pedoman hanya peringatan.</li>
              </ul>
            </div>

            <div className="border-2 border-void bg-gold/10 p-4 shadow-[inset_0_0_0_1px_#8f6a2f]">
              <p className="font-pixel text-[0.6rem] text-gold">Checklist</p>
              <ul className="mt-3 space-y-2 text-[0.8rem] text-ash">
                <Check ok={title.trim().length >= 3} label="Judul terisi" />
                <Check ok={textReady} label="Teks naskah siap" />
                <Check ok={privacyAccepted} label="Persetujuan LLM" />
              </ul>
            </div>
          </aside>
        </form>
      </div>
    </main>
  );
}

function RitualStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center border border-ridge bg-void/60 text-[0.66rem] font-bold text-gold">
        {n}
      </span>
      <div>
        <p className="text-xs font-bold text-bone">{title}</p>
        <p className="mt-0.5 text-[0.72rem] leading-4 text-ash">{body}</p>
      </div>
    </li>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`h-2 w-2 ${ok ? "bg-moss" : "bg-ridge"}`} />
      <span className={ok ? "text-bone" : "text-ash/60"}>{label}</span>
    </li>
  );
}
