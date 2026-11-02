import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { PixelSprite, type SpriteKind } from "@/components/brand/PixelSprite";

const STEPS = [
  {
    number: "01",
    title: "Buka naskah",
    body: "Masukkan DOCX atau PDF berteks. Naskah dibaca di browser, lalu AI memetakan klaim dan daftar pustaka.",
    tag: "INPUT",
    sprite: "scroll" as SpriteKind,
  },
  {
    number: "02",
    title: "Kunci peta",
    body: "Peta dikunci otomatis. Kamu tidak perlu menyetujui apa pun; langsung lihat denah dungeon.",
    tag: "VERIFY",
    sprite: "key" as SpriteKind,
  },
  {
    number: "03",
    title: "Recon",
    body: "Server memburu celah sitasi, gap argumen, dan klaim yang melampaui data. Setiap temuan jadi monster.",
    tag: "SCAN",
    sprite: "references" as SpriteKind,
  },
  {
    number: "04",
    title: "Pilih karakter",
    body: "Tiga penjaga, enam senjata. Pilih gaya bertahanmu sebelum pintu pertama terbuka.",
    tag: "LOADOUT",
    sprite: "hero" as SpriteKind,
  },
  {
    number: "05",
    title: "Turun",
    body: "Jelajahi ruang, tabrak monster, dan jawab serangan penguji. Hati habis, ekspedisi berakhir.",
    tag: "DUNGEON",
    sprite: "sir" as SpriteKind,
  },
];

const BOSSES: Array<{
  name: string;
  title: string;
  domain: string;
  line: string;
  danger: number;
  sprite: SpriteKind;
  tone: string;
  accentVar: string;
}> = [
  {
    name: "Veylith",
    title: "The Void Stalker",
    domain: "GAP HUNTER",
    line: "Predator kegelapan. Memburu klaim celah riset yang hilang tanpa dukungan referensi.",
    danger: 2,
    sprite: "gap",
    tone: "text-ember",
    accentVar: "--ember",
  },
  {
    name: "Draeven",
    title: "The Dreadfang",
    domain: "THE ALIGNER",
    line: "Binatang buas berkepala dua dengan kehendak berbeda. Mengoyak masalah, tujuan, dan RQ tak selaras.",
    danger: 2,
    sprite: "aligner",
    tone: "text-mana",
    accentVar: "--mana",
  },
  {
    name: "Kryvax",
    title: "The Twisted Brood",
    domain: "METHODOLOGIST",
    line: "Mutasi hasil eksperimen gagal yang terus berevolusi. Menyerang metode yang tidak menjawab RQ.",
    danger: 3,
    sprite: "methodologist",
    tone: "text-moss",
    accentVar: "--moss",
  },
  {
    name: "Morvane",
    title: "The Gravebound",
    domain: "THE AUDITOR",
    line: "Roh ksatria kuno penghakim wilayah. Menghukum kesimpulan yang berani melampaui data temuan.",
    danger: 3,
    sprite: "auditor",
    tone: "text-gold",
    accentVar: "--gold",
  },
  {
    name: "Nyxara",
    title: "The Forgotten Keeper",
    domain: "GHOST LIBRARY",
    line: "Penjaga arsip roh yang menghukum sitasi palsu, tidak lengkap, atau tidak dapat ditemukan.",
    danger: 2,
    sprite: "ghost" as SpriteKind,
    tone: "text-rune",
    accentVar: "--rune",
  },
  {
    name: "Eldravos",
    title: "The Ancient Sovereign",
    domain: "FINAL BOSS",
    line: "Penguasa dungeon tertinggi. Muncul di lantai terakhir. Menuntut seluruh naskahmu dipertanggungjawabkan.",
    danger: 3,
    sprite: "sir",
    tone: "text-blood",
    accentVar: "--blood",
  },
];

export default function Home() {
  return (
    <main className="dungeon-bg scanlines min-h-screen overflow-hidden">
      <a
        href="#main"
        className="sr-only z-50 bg-gold px-4 py-2 font-bold text-void focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Lewati ke konten
      </a>

      <SiteHeader />

      {/* ── HERO ── FULL VIEWPORT CINEMATIC ───────────────────────────────── */}
      <section
        id="main"
        className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-5 pb-20 pt-16 sm:px-8"
      >
        {/* ambient radial glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
        >
          {/* gold top bloom */}
          <div className="absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.07] blur-[120px] animate-glow-pulse" />
          {/* ember bottom bloom */}
          <div className="absolute bottom-0 left-1/2 h-[320px] w-[700px] -translate-x-1/2 translate-y-1/2 rounded-full bg-ember/[0.06] blur-[100px] animate-glow-pulse" style={{ animationDelay: "1.5s" }} />
          {/* mana left accent */}
          <div className="absolute left-0 top-1/2 h-[300px] w-[300px] -translate-y-1/2 rounded-full bg-mana/[0.04] blur-[80px]" />
          {/* dashed grid highlight */}
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-ridge/20" />
        </div>

        {/* floating dust particles */}
        <Particles />

        {/* hero content */}
        <div className="relative z-10 mx-auto w-full max-w-5xl text-center">
          {/* eyebrow badge */}
          <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
            <span className="pixel-chip border-blood/50 bg-blood/10 text-blood animate-flicker">
              ⚔ EKSPEDISI AKTIF
            </span>
            <span className="pixel-chip border-gold/40 bg-gold/8 text-gold">
              Research Boss Battle
            </span>
          </div>

          {/* main title — massive */}
          <h1
            className="font-pixel font-bold uppercase leading-[1.1] tracking-tight text-bone hero-title-in"
            data-text="Naskahmu Punya Boss."
          >
            <span className="block text-[clamp(2.6rem,8vw,6.5rem)] leading-[1.05]">
              Naskahmu
            </span>
            <span className="glitch block text-[clamp(3rem,10vw,8rem)] leading-[1.0] text-gold" data-text="Punya Boss.">
              Punya Boss.
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-[1.05rem] leading-7 text-ash sm:text-[1.15rem]">
            Unggah skripsi, proposal, atau artikel. AI memetakan klaim dan
            referensimu, lalu mengubah kelemahan naskah jadi monster yang{" "}
            <span className="text-bone font-semibold">harus kamu kalahkan dengan argumen.</span>
          </p>

          {/* CTA row */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="pixel-button pixel-button-shimmer border-gold bg-gold text-void hover:bg-bone text-base px-8 py-3"
            >
              Mulai Ekspedisi
              <span aria-hidden="true" className="ml-2 text-lg leading-none">▶</span>
            </Link>
            <a
              href="#cara-kerja"
              className="pixel-button border-ridge bg-tomb/80 text-bone hover:border-rune hover:text-gold px-6 py-3"
            >
              Lihat Alur
            </a>
          </div>

          {/* stat trio */}
          <div className="mx-auto mt-12 grid max-w-sm grid-cols-3 border-2 border-ridge/60 bg-void/80">
            <HeroStat value="6" label="Boss" />
            <HeroStat value="3" label="Karakter" />
            <HeroStat value="5" label="Pos Ekspedisi" />
          </div>

          {/* flow hint */}
          <p className="mt-5 flex items-center justify-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-ash/60">
            <span className="h-2 w-2 animate-flicker bg-moss" />
            Naskah → Peta → Recon → Karakter → Dungeon
          </p>
        </div>

        {/* bottom dungeon-floor edge */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 inset-x-0 h-16 wall-stone opacity-60"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 inset-x-0 flex justify-around px-4"
        >
          {[...Array(6)].map((_, i) => (
            <span key={i} className="torch-flame opacity-70" />
          ))}
        </div>
      </section>

      {/* ── DUNGEON PREVIEW PANEL ─────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8">
        <div className="flex-divider mb-10">
          <span className="floor-divider font-pixel text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ridge">
            ◆ Contoh run ◆
          </span>
        </div>
        <DungeonPreview />
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="cara-kerja" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        <div className="mb-12 text-center">
          <p className="eyebrow">Jalur dungeon</p>
          <h2 className="mt-3 font-pixel text-2xl font-bold uppercase leading-[1.2] text-bone sm:text-3xl">
            Lima Pos. Satu Naskah.{" "}
            <span className="text-ember">Banyak Alasan.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[0.95rem] leading-7 text-ash">
            Bukan chatbot yang menilai gaya bahasa. Ini ekspedisi yang menuntut
            bukti dari klaim yang benar-benar kamu tulis.
          </p>
        </div>

        <div className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* connector line */}
          <div
            className="absolute left-[8%] right-[8%] top-14 hidden border-t-2 border-dashed border-ridge/60 lg:block"
            aria-hidden="true"
          />
          {STEPS.map((step, idx) => (
            <article
              key={step.number}
              className="pixel-panel-soft relative p-4"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="font-pixel text-[0.7rem] font-bold text-gold">
                  ROOM {step.number}
                </span>
                <span className="pixel-chip">{step.tag}</span>
              </div>
              <div className="tile-floor mt-4 flex h-24 items-end justify-center border-2 border-void">
                <PixelSprite
                  kind={step.sprite}
                  size={58}
                  className="relative -mb-1 drop-shadow-[0_5px_0_rgba(0,0,0,0.45)]"
                />
              </div>
              <h3 className="mt-3 font-pixel text-sm font-bold text-bone">{step.title}</h3>
              <p className="mt-1.5 text-[0.82rem] leading-[1.55] text-ash">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── BOSS BESTIARY ────────────────────────────────────────────────── */}
      <section id="boss" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        {/* section header */}
        <div className="mb-3 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Bestiari dungeon</p>
            <h2 className="mt-3 font-pixel text-2xl font-bold uppercase leading-[1.2] text-bone sm:text-3xl">
              Kenali Musuhmu.{" "}
              <span className="text-blood">Atau Mati Mencoba.</span>
            </h2>
            <p className="mt-3 max-w-xl text-[0.95rem] leading-7 text-ash">
              Enam Floor Lord menunggu di setiap ujung lantai. Setiap boss
              mewakili kelemahan naskah nyata. Tidak ada bypass — hanya argumen.
            </p>
          </div>
          <span className="pixel-chip border-blood/40 bg-blood/8 text-blood">6 Floor Lords</span>
        </div>

        {/* danger stripe decoration */}
        <div className="danger-stripe mb-8 h-1.5 w-full opacity-50" aria-hidden="true" />

        {/* boss grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BOSSES.map((boss) => (
            <article
              key={boss.name}
              className="boss-card pixel-panel relative overflow-hidden"
            >
              {/* accent glow top edge */}
              <div
                className="absolute inset-x-0 top-0 h-0.5 opacity-70"
                style={{ background: `var(${boss.accentVar})` }}
                aria-hidden="true"
              />

              <div className="p-4">
                {/* header row */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className={`boss-domain font-pixel text-[0.6rem] font-bold uppercase tracking-[0.1em] ${boss.tone}`}
                    >
                      {boss.domain}
                    </p>
                    <h3 className="mt-1 font-pixel text-base font-bold text-bone">
                      {boss.name}
                    </h3>
                    <p className="text-[0.72rem] text-ash">{boss.title}</p>
                  </div>
                  <div className="tile-floor flex-shrink-0 border border-void p-2 shadow-[inset_0_0_0_1px_#0a0f14]">
                    <PixelSprite kind={boss.sprite} size={48} />
                  </div>
                </div>

                {/* lore line */}
                <p className="mt-3 text-[0.83rem] leading-[1.55] text-ash">
                  {boss.line}
                </p>

                {/* threat bar */}
                <div className="mt-4 flex items-center gap-2 border-t border-ridge/50 pt-3">
                  <span className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash">
                    Ancaman
                  </span>
                  <span
                    className="boss-threat-bar flex gap-1"
                    aria-label={`Ancaman ${boss.danger} dari 3`}
                  >
                    {[1, 2, 3].map((level) => (
                      <span
                        key={level}
                        className={`h-2 w-6 border border-void transition-colors ${
                          level <= boss.danger ? "bg-ember" : "bg-ridge/40"
                        }`}
                      />
                    ))}
                  </span>
                  {boss.danger === 3 && (
                    <span className="ml-auto font-pixel text-[0.55rem] text-blood animate-flicker">
                      ELITE
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* minion panel */}
        <div className="mt-6 border-2 border-void bg-[#0a0f14]/90 p-4 shadow-[inset_0_0_0_1px_#34424e]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="font-pixel text-[0.58rem] text-gold">
                DUNGEON CREATURES (ANTEK PENJAGA RUANG)
              </span>
              <p className="mt-0.5 text-xs text-ash">
                Monster kecil yang menguji setiap ruang temuan sebelum kamu berhadapan dengan Floor Lord:
              </p>
            </div>
            <span className="text-[0.68rem] text-ash/70 font-mono">8 Entitas Minion</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {[
              ["Varkul", "Brutish beast"],
              ["Nethrix", "Shadow crawler"],
              ["Zorveth", "Armored creature"],
              ["Thalgrim", "Stone guardian"],
              ["Xyrath", "Winged predator"],
              ["Othrak", "Undead warrior"],
              ["Velmora", "Cursed spirit"],
              ["Grivak", "Small dungeon beast"],
            ].map(([name, type]) => (
              <span
                key={name}
                className="border border-ridge/60 bg-void/60 px-2.5 py-1 text-bone hover:border-gold/40 hover:text-gold transition-colors"
              >
                <strong>{name}</strong> · {type}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-24 pt-4 sm:px-8">
        <div className="pixel-panel pixel-panel-gold relative overflow-hidden">
          {/* dungeon room decoration — right side */}
          <div
            className="absolute inset-y-0 right-0 hidden w-64 border-l-2 border-void bg-[#0a0f14] md:block"
            aria-hidden="true"
          >
            <div className="tile-floor absolute inset-0 opacity-60" />
            <div className="absolute inset-x-0 top-0 h-8 wall-stone" />
            <div className="absolute inset-x-0 bottom-0 h-8 wall-stone" />
            <div className="absolute left-1/2 top-1/2 grid h-28 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center border-4 border-gold bg-[#0a0f14] shadow-[inset_0_0_0_3px_#080b10]">
              <span className="font-pixel text-[0.55rem] text-gold">NEXT</span>
            </div>
            <span className="torch-flame absolute left-8 top-20" />
            <span className="torch-flame absolute right-8 top-20" />
          </div>

          <div className="relative p-6 sm:p-10 md:pr-72">
            <p className="eyebrow">Gerbang terakhir</p>
            <h2 className="mt-3 font-pixel text-xl font-bold uppercase leading-[1.25] text-bone sm:text-3xl">
              Naskahmu Sudah Siap Diuji?
            </h2>
            <p className="mt-3 text-[0.95rem] leading-7 text-ash max-w-lg">
              Unggah naskah, lihat denah yang terbentuk, lalu lihat apakah
              argumenmu bertahan saat setiap klaim diminta pertanggungjawaban.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/upload"
                className="pixel-button pixel-button-shimmer border-gold bg-gold text-void hover:bg-bone"
              >
                Unggah Naskah
              </Link>
              <Link
                href="/login"
                className="pixel-button border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold"
              >
                Masuk
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t-2 border-void bg-void/90">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link href="/" className="w-fit hover:opacity-90">
            <Logo size={34} tagline />
          </Link>
          <p className="text-sm leading-6 text-ash">
            Klaim yang tidak diuji adalah klaim yang menunggu.
          </p>
        </div>
      </footer>
    </main>
  );
}

/* ─── SUB-COMPONENTS ──────────────────────────────────────────────────────── */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-void bg-void/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link href="/" className="group hover:opacity-90">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Navigasi utama">
          <a
            href="#cara-kerja"
            className="px-3 py-1.5 text-[0.78rem] font-bold uppercase tracking-[0.06em] text-ash transition-colors hover:text-bone"
          >
            Alur
          </a>
          <a
            href="#boss"
            className="px-3 py-1.5 text-[0.78rem] font-bold uppercase tracking-[0.06em] text-ash transition-colors hover:text-bone"
          >
            Boss
          </a>
          <Link
            href="/login"
            className="pixel-button border-ridge bg-tomb text-bone hover:border-rune text-[0.78rem] px-3 py-1.5"
          >
            Masuk
          </Link>
          <Link
            href="/dashboard"
            className="pixel-button pixel-button-shimmer border-gold bg-gold text-void hover:bg-bone text-[0.78rem] px-3 py-1.5"
          >
            Mulai
          </Link>
        </nav>
      </div>
    </header>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-r-2 border-ridge/60 px-4 py-3 text-center last:border-r-0">
      <p className="font-pixel text-xl font-bold text-gold">{value}</p>
      <p className="mt-0.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash">
        {label}
      </p>
    </div>
  );
}

function Particles() {
  const items = [
    { left: "10%", bottom: "20%", dur: "7s", delay: "0s", drift: "15px" },
    { left: "22%", bottom: "15%", dur: "9s", delay: "1.2s", drift: "-10px" },
    { left: "38%", bottom: "25%", dur: "6s", delay: "0.5s", drift: "8px" },
    { left: "55%", bottom: "10%", dur: "8s", delay: "2s", drift: "-14px" },
    { left: "70%", bottom: "30%", dur: "7.5s", delay: "0.8s", drift: "12px" },
    { left: "84%", bottom: "18%", dur: "10s", delay: "1.8s", drift: "-8px" },
    { left: "92%", bottom: "22%", dur: "6.5s", delay: "3s", drift: "6px" },
    { left: "47%", bottom: "35%", dur: "8.5s", delay: "1.4s", drift: "-18px" },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {items.map((p, i) => (
        <span
          key={i}
          className="hero-particle"
          style={{
            left: p.left,
            bottom: p.bottom,
            ["--dur" as string]: p.dur,
            ["--delay" as string]: p.delay,
            ["--drift-x" as string]: p.drift,
          }}
        />
      ))}
    </div>
  );
}

function DungeonPreview() {
  return (
    <div className="mx-auto w-full max-w-2xl animate-[game-screen-in_500ms_steps(6,end)_both]">
      <div className="game-screen">
        {/* title bar */}
        <div className="flex items-center gap-2 border-b-2 border-void bg-[#111920] px-3 py-2">
          <span className="h-2.5 w-2.5 animate-flicker bg-moss" />
          <span className="font-pixel text-[0.6rem] text-ash">
            Dungeon run 001 &nbsp;·&nbsp; Lantai 01
          </span>
          <span className="ml-auto font-pixel text-[0.6rem] text-gold animate-flicker">
            ▶ LIVE
          </span>
        </div>

        {/* scene */}
        <div className="relative">
          <div className="wall-stone h-7" />
          <div className="tile-floor relative flex h-40 items-end px-6 pb-3">
            {/* torch left */}
            <div className="absolute left-5 top-2 flex flex-col items-center gap-0.5">
              <span className="torch-flame" />
              <span className="h-4 w-1 bg-[#5c3a1e]" />
            </div>
            {/* torch right */}
            <div className="absolute right-5 top-2 flex flex-col items-center gap-0.5">
              <span className="torch-flame" />
              <span className="h-4 w-1 bg-[#5c3a1e]" />
            </div>

            {/* hero */}
            <div className="flex flex-col items-center gap-1">
              <PixelSprite kind="hero" size={52} className="animate-bob drop-shadow-[0_4px_0_rgba(0,0,0,0.6)]" />
              <span className="font-pixel text-[0.52rem] text-gold">PENJAGA</span>
            </div>

            {/* gap */}
            <div className="mx-auto" />

            {/* door */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <div className="grid h-14 w-10 place-items-center border-2 border-gold bg-[#080b10] shadow-[inset_0_0_8px_rgba(233,184,93,0.25)]">
                <span className="font-pixel text-[0.45rem] text-gold/80 animate-flicker">EXIT</span>
              </div>
            </div>

            {/* boss */}
            <div className="flex flex-col items-center gap-1">
              <PixelSprite kind="gap" size={52} className="drop-shadow-[0_4px_0_rgba(0,0,0,0.6)] animate-floaty" />
              <span className="font-pixel text-[0.52rem] text-ember">VEYLITH</span>
            </div>
          </div>
          <div className="wall-stone h-7" />
        </div>

        {/* boss HP bar */}
        <div className="border-t-2 border-void bg-[#0d141b] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-pixel text-[0.58rem] font-bold text-ember">
                VEYLITH · GAP HUNTER
              </p>
              <p className="font-pixel text-[0.52rem] text-ash/60">Floor Lord · Lantai 01</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-pixel text-[0.58rem] text-ash">HP</span>
              <div className="flex gap-0.5">
                {[...Array(10)].map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-3 border border-void ${i < 10 ? "bg-ember" : "bg-ridge/40"}`}
                  />
                ))}
              </div>
              <span className="font-pixel text-[0.58rem] text-ember">100/100</span>
            </div>
          </div>
        </div>

        {/* dialogue */}
        <div className="border-t-2 border-void bg-[#0a0f14] px-4 py-3">
          <div className="border border-ridge/50 p-3">
            <p className="font-pixel text-[0.58rem] font-bold text-gold">
              ELDRAVOS · THE ANCIENT SOVEREIGN
            </p>
            <p className="mt-1 text-[0.78rem] leading-5 text-bone">
              "Klaim itu belum tentu salah. Tapi belum kamu buktikan di hadapanku."
            </p>
          </div>
        </div>

        {/* scene stats */}
        <div className="grid grid-cols-3 border-t-2 border-void bg-[#111920]">
          <SceneStat label="Nyawa" value="♥ ♥ ♥" tone="text-blood" />
          <SceneStat label="Ruang" value="3 / 7" tone="text-gold" />
          <SceneStat label="Temuan" value="8" tone="text-mana" />
        </div>
      </div>

      <p className="mt-3 flex items-center justify-center gap-2 text-center text-[0.68rem] font-bold uppercase tracking-[0.08em] text-ash/70">
        <span className="h-2 w-2 animate-flicker bg-ember" />
        Contoh run · setiap temuan jadi ruang
      </p>
    </div>
  );
}

function SceneStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="border-r-2 border-void px-2 py-2 text-center last:border-r-0">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash">{label}</p>
      <p className={`mt-1 text-[0.78rem] font-bold ${tone}`}>{value}</p>
    </div>
  );
}
