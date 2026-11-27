"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReadingOverlay from "@/components/manuscript/ReadingOverlay";
import { useMusic } from "@/lib/useMusic";
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
  useMusic("camp");
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [field, setField] = useState("");
  const [stage, setStage] = useState<"proposal" | "skripsi" | "jurnal">("skripsi");
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [sourceText, setSourceText] = useState("");
  const [showFullMarkdown, setShowFullMarkdown] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [unclearReason, setUnclearReason] = useState<string | null>(null);
  const [reviseFrom, setReviseFrom] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("reviseFrom");
    if (!id) return;
    setReviseFrom(id);
    void authJson<{
      manuscript: {
        title: string;
        field: string | null;
        language: "id" | "en";
        stage: "proposal" | "skripsi" | "jurnal";
      };
    }>(`/api/manuscripts/${id}`)
      .then(({ manuscript }) => {
        setTitle(manuscript.title);
        setField(manuscript.field ?? "");
        setLanguage(manuscript.language);
        setStage(manuscript.stage);
      })
      .catch(() => {
        // Revision metadata is optional; upload still works as a new manuscript.
      });
  }, []);

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
    setMissing([]);
    setUnclearReason(null);
    setExtracting(true);
    setShowFullMarkdown(false);
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
    await upload(false);
  }

  async function upload(confirmUnclear: boolean) {
    setBusy(true);
    setError(null);
    setMissing([]);
    setUnclearReason(null);
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
          sourceText,
          ...(reviseFrom ? { manuscriptId: reviseFrom } : {}),
          ...(confirmUnclear ? { confirmUnclear: true } : {}),
        }),
      });
      router.push(`/map/${payload.researchMapId}`);
    } catch (err) {
      const body = (
        err as { body?: { missing?: string[]; reason?: string; needsConfirmation?: boolean } }
      ).body;
      if (body?.missing?.length) setMissing(body.missing);
      if (body?.needsConfirmation) {
        setUnclearReason(body.reason ?? "Struktur naskah sulit dikenali.");
      } else {
        const message = err instanceof Error ? err.message : "Gagal mengunggah naskah.";
        setError(body?.reason ? `${message} ${body.reason}` : message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <main className="font-game grid min-h-[100dvh] place-items-center px-4">
        <p className="ui-box g-1" role="status">
          Membuka gerbang...
        </p>
      </main>
    );
  }

  const textReady = sourceText.length >= 300;
  const canSubmit = textReady && title.trim().length >= 3 && privacyAccepted && !busy && !extracting;

  return (
    <main className="font-game flex min-h-[100dvh] items-center justify-center px-4 py-16">
      {busy ? <ReadingOverlay fileName={fileName} /> : null}

      <Link href="/dashboard" data-sfx="uiCancel" className="ui-btn is-quiet absolute left-3 top-3">
        Kembali
      </Link>

      <form onSubmit={submit} className="ui-box w-full max-w-[36rem] space-y-3" aria-labelledby="upload-title">
        <h1 id="upload-title" className="g-2">
          {reviseFrom ? "Unggah revisi" : "Naskah baru"}
        </h1>

        <label
          className={`ui-chip block cursor-pointer text-center ${extracting ? "opacity-70" : ""}`}
          aria-busy={extracting}
        >
          <input
            type="file"
            accept=".docx,.pdf,.txt,.md"
            onChange={(event) => void pickFile(event.target.files?.[0] ?? null)}
            className="sr-only"
          />
          <img
            src="/assets/ninja-adventure/items/scroll.png"
            alt=""
            width={48}
            height={48}
            className="ui-icon mx-auto"
          />
          <span className="g-1 mt-1 block">
            {extracting
              ? "Membaca file..."
              : fileName
                ? fileName
                : "Pilih file naskah"}
          </span>
          <span className="g-1 block text-[var(--ui-rust)]">
            {fileName && !extracting
              ? textReady
                ? `${sourceText.length.toLocaleString("id-ID")} karakter`
                : "Teks terlalu pendek"
              : "DOCX, PDF berteks, TXT, MD"}
          </span>
        </label>

        <label className="block">
          <span className="g-1 block">Judul</span>
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Judul naskah"
            className="pixel-input mt-1"
          />
        </label>

        <fieldset>
          <legend className="g-1">Jenis naskah</legend>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {(
              [
                ["proposal", "Proposal"],
                ["skripsi", "Skripsi"],
                ["jurnal", "Jurnal"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={stage === value}
                onClick={() => setStage(value)}
                className={`ui-btn ${stage === value ? "" : "is-quiet"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <details className="g-1">
          <summary className="cursor-pointer text-[var(--ui-rust)]">Lainnya</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="g-1 block">Bidang</span>
              <input
                value={field}
                onChange={(event) => setField(event.target.value)}
                placeholder="mis. pendidikan"
                className="pixel-input mt-1"
              />
            </label>
            <label className="block">
              <span className="g-1 block">Bahasa</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as typeof language)}
                className="pixel-input mt-1"
              >
                <option value="id">Indonesia</option>
                <option value="en">Inggris</option>
              </select>
            </label>
          </div>
        </details>

        <label className="g-1 flex items-start gap-2">
          <input
            type="checkbox"
            checked={privacyAccepted}
            onChange={(event) => setPrivacyAccepted(event.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-[#f06733]"
          />
          <span>Teks naskah dikirim ke AI untuk dianalisis dan disimpan di akunmu.</span>
        </label>

        {error ? (
          <p role="alert" className="g-1 text-[#a3341f]">
            {error}
          </p>
        ) : null}

        {unclearReason || missing.length > 0 ? (
          <div className="ui-chip g-1" role="status">
            {unclearReason ? (
              <>
                <p>Dokumen ini kurang jelas sebagai naskah ilmiah.</p>
                <p className="text-[var(--ui-rust)]">{unclearReason}</p>
              </>
            ) : null}
            {missing.length > 0 ? (
              <p className={unclearReason ? "mt-2" : ""}>Tidak terdeteksi: {missing.join(", ")}</p>
            ) : null}
            {unclearReason ? (
              <button type="button" onClick={() => void upload(true)} disabled={busy} className="ui-btn mt-2 w-full">
                Tetap lanjut
              </button>
            ) : null}
          </div>
        ) : null}

        <button type="submit" disabled={!canSubmit} className="ui-btn w-full">
          {busy ? "AI membaca naskah..." : "Mulai"}
        </button>
      </form>
    </main>
  );
}
