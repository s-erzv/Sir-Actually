import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export const metadata = {
  title: "Tentang · Sir, Actually",
};

export default function AboutPage() {
  return (
    <main className="dungeon-bg scanlines min-h-screen">
      <header className="border-b-2 border-void bg-void/90">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="hover:opacity-90">
            <Logo tagline />
          </Link>
          <Link
            href="/dashboard"
            className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ash hover:text-gold"
          >
            Kembali
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="eyebrow">Tentang</p>
        <h1 className="mt-3 text-3xl font-bold text-bone sm:text-4xl">Sir, Actually</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ash">
          Game pertahanan naskah: Recon memetakan kelemahan riset, lalu kamu
          mempertahankannya di dungeon. Penilaian memakai rubrik tetap dan damage
          dihitung kode, bukan model bahasa. Bukan pengganti dosen pembimbing.
        </p>

        <section className="mt-8 border-2 border-ridge/60 bg-void/45 p-4">
          <h2 className="font-pixel text-[0.58rem] uppercase tracking-[0.1em] text-gold">
            Kredit aset
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-ash">
            <li>
              Kenney Tiny Dungeon dan Kenney Roguelike — CC0. Digunakan untuk tile,
              prop, dan loot.
            </li>
            <li>
              Dibangun dengan Next.js, React, Phaser, Tailwind CSS, dan Supabase.
            </li>
            <li>
              Teks naskah dikirim ke penyedia LLM yang dikonfigurasi untuk ekstraksi
              dan tanya-jawab. Jangan unggah naskah yang tidak boleh diproses pihak
              ketiga.
            </li>
          </ul>
        </section>

        <section className="mt-4 border-2 border-ridge/60 bg-void/45 p-4">
          <h2 className="font-pixel text-[0.58rem] uppercase tracking-[0.1em] text-gold">
            Aksesibilitas
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-ash">
            <li>Kontrol keyboard: panah atau WASD. Mobile: D-pad di kiri bawah.</li>
            <li>Semua dialog memakai role dialog dan label yang terbaca screen reader.</li>
            <li>Animasi dikurangi otomatis saat sistem meminta reduced motion.</li>
            <li>Fokus keyboard punya outline yang jelas di semua tombol dan field.</li>
          </ul>
        </section>

        <Link
          href="/dashboard"
          className="pixel-button mt-8 inline-flex border-gold bg-gold text-void hover:bg-bone"
        >
          Kembali ke arsip
        </Link>
      </div>
    </main>
  );
}
