import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { PixelSprite, type SpriteKind } from "@/components/brand/PixelSprite";
import { LandingDiorama } from "@/components/game/LandingDiorama";

const STEPS: Array<{
  number: string;
  title: string;
  body: string;
  tag: string;
  sprite: SpriteKind;
  status: string;
}> = [
  {
    number: "01",
    title: "Buka naskah",
    body: "Masukkan DOCX, PDF berteks, MD, atau TXT. Naskah dibaca di browser, lalu AI memetakan klaim dan daftar pustakamu.",
    tag: "INPUT",
    sprite: "scroll",
    status: "Gerbang masuk",
  },
  {
    number: "02",
    title: "Peta terbentuk",
    body: "Setiap kelemahan jadi monster. Setiap temuan jadi ruang. Lantai disusun dari dimensi yang benar-benar ada di naskahmu.",
    tag: "GENERATE",
    sprite: "key",
    status: "Denah dikunci",
  },
  {
    number: "03",
    title: "Turun & bertahan",
    body: "Jelajahi ruang, hadapi penguji, jawab dengan bukti dari naskahmu sendiri. Nyawa habis, ekspedisi berakhir.",
    tag: "DUNGEON",
    sprite: "hero",
    status: "Mulai run",
  },
];

const GATES: Array<{ label: string; question: string; tone: string }> = [
  {
    label: "GAP",
    question: "Klaim ini berdiri di atas referensi apa?",
    tone: "text-ember",
  },
  {
    label: "KESELARASAN",
    question: "Masalah, tujuan, dan pertanyaanmu satu arah?",
    tone: "text-mana",
  },
  {
    label: "METODE",
    question: "Metode ini benar-benar menjawab pertanyaanmu?",
    tone: "text-moss",
  },
  {
    label: "KESIMPULAN",
    question: "Kesimpulan ini melampaui datamu?",
    tone: "text-gold",
  },
];

const GUARDIANS: Array<{ slug: SpriteKind; name: string; role: string; line: string }> = [
  {
    slug: "arka",
    name: "Arka",
    role: "Pendebat",
    line: "Serangan pertama di tiap ruang lebih tajam.",
  },
  {
    slug: "mira",
    name: "Mira",
    role: "Pengarsip",
    line: "Sekali per lantai, buka petunjuk bagian naskah.",
  },
  {
    slug: "sena",
    name: "Sena",
    role: "Penjaga",
    line: "Nyawa awal lebih banyak. Bertahan lebih lama.",
  },
];

const REWARDS: Array<{ title: string; body: string; sprite: SpriteKind }> = [
  {
    title: "Peta kelemahan",
    body: "Profil per dimensi: mana yang kuat, mana yang perlu dibenahi, lengkap dengan kutipan naskahmu.",
    sprite: "scroll",
  },
  {
    title: "Rank & poin",
    body: "Poin dari monster, lantai, dan streak. Rank S sampai B dihitung dari performa run-mu.",
    sprite: "chest",
  },
  {
    title: "Catatan penjaga",
    body: "Setiap kalah menghasilkan catatan yang menunjuk bagian naskah dan kriteria yang belum terpenuhi.",
    sprite: "key",
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

      {/* ── HERO · TITLE SCREEN ──────────────────────────────────────────── */}
      <section
        id="main"
        className="hero-stage flex min-h-[100svh] flex-col items-center justify-center px-5 pb-48 pt-24 text-center sm:px-8"
      >
        <div className="hero-grid" aria-hidden="true" />
        <Particles />
        <HeroTorches />
        <div className="hero-floor" aria-hidden="true" />

        <div className="relative z-10 mx-auto w-full max-w-4xl">
          <div className="mb-7 flex flex-wrap items-center justify-center gap-2">
            <span className="pixel-chip border-blood/50 bg-blood/10 text-blood">
              <span className="h-1.5 w-1.5 animate-flicker bg-blood" />
              Browser game
            </span>
            <span className="pixel-chip border-gold/40 bg-gold/10 text-gold">
              Naskah jadi dungeon
            </span>
          </div>

          <h1 className="hero-title hero-title-in font-pixel font-bold uppercase leading-[1.02] tracking-tight text-bone">
            <span className="block text-[clamp(2.8rem,8.5vw,6.5rem)]">Naskahmu</span>
            <span className="hero-accent block text-[clamp(3.2rem,10.5vw,8rem)]">
              punya boss.
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-xl text-[1rem] leading-7 text-ash sm:text-[1.12rem]">
            Unggah skripsi, proposal, atau artikel. AI mengubah setiap kelemahan
            naskah jadi monster yang harus kamu kalahkan dengan argumen.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="pixel-button pixel-button-shimmer border-gold bg-gold px-8 py-3 text-base text-void hover:bg-bone"
            >
              Turun ke dungeon
              <span aria-hidden="true" className="ml-1 text-lg leading-none">
                ▶
              </span>
            </Link>
            <a
              href="#cara-main"
              className="pixel-button border-ridge bg-tomb/80 px-6 py-3 text-bone hover:border-rune hover:text-gold"
            >
              Cara main
            </a>
          </div>

          <p className="mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.64rem] font-bold uppercase tracking-[0.1em] text-ash/60">
            <span>Tanpa install</span>
            <span className="text-ridge" aria-hidden="true">◆</span>
            <span>±10 menit per run</span>
            <span className="text-ridge" aria-hidden="true">◆</span>
            <span>Bahasa Indonesia</span>
          </p>
        </div>

        <div className="absolute bottom-44 left-1/2 z-10 -translate-x-1/2 text-center">
          <p className="font-pixel text-[0.55rem] uppercase tracking-[0.2em] text-ash/50">
            Gulir untuk masuk
          </p>
          <span className="scroll-cue mx-auto mt-2 block h-3 w-3 border-b-2 border-r-2 border-gold/60 [transform:rotate(45deg)]" />
        </div>
      </section>

      {/* ── GAME SCREEN ──────────────────────────────────────────────────── */}
      <section className="relative z-20 mx-auto -mt-40 w-full max-w-4xl px-5 pb-20 sm:px-8">
        <GameScreen />
      </section>

      {/* ── TICKER ───────────────────────────────────────────────────────── */}
      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex">
              {[
                "Sitasi palsu",
                "Gap argumen",
                "Metode tidak menjawab RQ",
                "Kesimpulan melampaui data",
                "Klaim tanpa bukti",
                "Sampel tidak dilaporkan",
                "Generalisasi berlebihan",
                "Batasan tidak disebut",
              ].map((item) => (
                <span key={item} className="ticker-item">
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="cara-main" className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="eyebrow">Cara main</p>
          <h2 className="mt-3 font-pixel text-2xl font-bold uppercase leading-[1.2] text-bone sm:text-3xl">
            Tiga pos. Lalu <span className="text-gold">turun.</span>
          </h2>
          <p className="mt-4 text-[0.95rem] leading-7 text-ash">
            Bukan chatbot yang menilai gaya bahasa. Ini ekspedisi yang menuntut
            bukti dari klaim yang benar-benar kamu tulis.
          </p>
        </div>

        <div className="relative grid gap-4 md:grid-cols-3">
          <div
            className="absolute left-[16%] right-[16%] top-[7.5rem] hidden border-t-2 border-dashed border-ridge/60 md:block"
            aria-hidden="true"
          />
          {STEPS.map((step) => (
            <article key={step.number} className="room-node pixel-panel-soft relative p-4">
              <span
                className="absolute left-1/2 top-0 z-10 h-2 w-10 -translate-x-1/2 -translate-y-1/2 border-2 border-void bg-gold"
                aria-hidden="true"
              />
              <div className="flex items-start justify-between gap-4">
                <span className="font-pixel text-[0.7rem] font-bold text-gold">
                  POS {step.number}
                </span>
                <span className="pixel-chip">{step.tag}</span>
              </div>

              <div className="tile-floor relative mt-4 flex h-32 items-end justify-center border-2 border-void">
                <span className="torch-flame absolute left-2 top-2 opacity-80" aria-hidden="true" />
                <span className="torch-flame absolute right-2 top-2 opacity-80" aria-hidden="true" />
                <PixelSprite
                  kind={step.sprite}
                  size={66}
                  className="room-sprite relative -mb-1 drop-shadow-[0_6px_0_rgba(0,0,0,0.5)]"
                />
              </div>

              <h3 className="mt-3 font-pixel text-base font-bold text-bone">{step.title}</h3>
              <p className="mt-2 text-[0.84rem] leading-[1.6] text-ash">{step.body}</p>

              <p className="mt-4 flex items-center gap-2 border-t border-ridge/50 pt-3 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-ash/70">
                <span className="h-1.5 w-1.5 bg-moss" />
                {step.status}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ── WHAT GETS TESTED ─────────────────────────────────────────────── */}
      <section className="border-y-2 border-void bg-crypt/75">
        <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="eyebrow">Yang diuji</p>
            <h2 className="mt-3 font-pixel text-2xl font-bold uppercase leading-[1.2] text-bone sm:text-3xl">
              Empat gerbang <span className="text-ember">ujian.</span>
            </h2>
            <p className="mt-4 text-[0.95rem] leading-7 text-ash">
              Setiap lantai menjaga satu dimensi naskah. Tidak ada tebakan acak —
              semua pertanyaan berakar pada kutipan naskahmu.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GATES.map((gate, index) => (
              <article
                key={gate.label}
                className="payoff-card pixel-panel relative overflow-hidden p-5"
              >
                <div className="flex items-baseline justify-between">
                  <span className={`font-pixel text-4xl font-bold leading-none ${gate.tone}`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-pixel text-[0.55rem] tracking-[0.12em] text-ash/50">
                    GERBANG
                  </span>
                </div>
                <h3 className={`mt-5 font-pixel text-sm font-bold uppercase tracking-[0.08em] ${gate.tone}`}>
                  {gate.label}
                </h3>
                <p className="mt-2 text-[0.88rem] leading-[1.6] text-ash">
                  {gate.question}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── GUARDIANS ────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="eyebrow">Loadout</p>
          <h2 className="mt-3 font-pixel text-2xl font-bold uppercase leading-[1.2] text-bone sm:text-3xl">
            Pilih <span className="text-mana">penjagamu.</span>
          </h2>
          <p className="mt-4 text-[0.95rem] leading-7 text-ash">
            Tiga penjaga, dua senjata masing-masing. Gaya bertahanmu menentukan
            Nyawa dan damage — bukan penilaian jawaban.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {GUARDIANS.map((guardian) => (
            <article key={guardian.name} className="payoff-card pixel-panel-soft overflow-hidden">
              <div className="tile-floor relative flex h-40 items-end justify-center border-b-2 border-void">
                <div className="pointer-events-none absolute bottom-8 h-16 w-24 rounded-full bg-gold/10 blur-xl" aria-hidden="true" />
                <div className="absolute bottom-6 h-3 w-16 bg-black/50 blur-[1px]" aria-hidden="true" />
                <PixelSprite
                  kind={guardian.slug}
                  size={96}
                  className="relative -mb-1 drop-shadow-[0_6px_0_rgba(0,0,0,0.45)]"
                />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-pixel text-base font-bold text-bone">{guardian.name}</h3>
                  <span className="pixel-chip border-gold/40 text-gold">{guardian.role}</span>
                </div>
                <p className="mt-3 text-[0.86rem] leading-[1.6] text-ash">{guardian.line}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── REWARDS ──────────────────────────────────────────────────────── */}
      <section id="imbalan" className="border-y-2 border-void bg-crypt/75">
        <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="eyebrow">Imbalan</p>
            <h2 className="mt-3 font-pixel text-2xl font-bold uppercase leading-[1.2] text-bone sm:text-3xl">
              Yang kamu bawa <span className="text-gold">pulang.</span>
            </h2>
            <p className="mt-4 text-[0.95rem] leading-7 text-ash">
              Bukan vonis layak atau tidak layak. Peta kelemahan yang bisa kamu
              pakai untuk memperbaiki naskah besok pagi.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {REWARDS.map((reward) => (
              <article key={reward.title} className="payoff-card pixel-panel p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center border-2 border-void bg-[#0a0f14] shadow-[2px_2px_0_#05080b]">
                    <PixelSprite kind={reward.sprite} size={30} />
                  </span>
                  <h3 className="font-pixel text-sm font-bold uppercase tracking-[0.04em] text-bone">
                    {reward.title}
                  </h3>
                </div>
                <p className="mt-4 text-[0.87rem] leading-[1.6] text-ash">{reward.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <div className="pixel-panel pixel-panel-gold relative overflow-hidden">
          <div
            className="absolute inset-y-0 right-0 hidden w-72 border-l-2 border-void bg-[#0a0f14] md:block"
            aria-hidden="true"
          >
            <div className="tile-floor absolute inset-0 opacity-70" />
            <div className="absolute inset-x-0 top-0 h-8 wall-stone" />
            <div className="absolute inset-x-0 bottom-0 h-8 wall-stone" />
            <div className="absolute left-1/2 top-1/2 grid h-32 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center border-4 border-gold bg-[#0a0f14] shadow-[inset_0_0_0_3px_#080b10,0_0_28px_rgba(233,184,93,0.25)]">
              <span className="font-pixel text-[0.55rem] text-gold">MASUK</span>
            </div>
            <span className="torch-flame absolute left-8 top-20" />
            <span className="torch-flame absolute right-8 top-20" />
            <span className="torch-flame absolute bottom-16 left-10 opacity-70" />
          </div>

          <div className="relative p-6 sm:p-10 md:pr-80">
            <p className="eyebrow">Gerbang terakhir</p>
            <h2 className="mt-3 font-pixel text-2xl font-bold uppercase leading-[1.2] text-bone sm:text-3xl">
              Naskahmu siap <span className="text-gold">diuji?</span>
            </h2>
            <p className="mt-3 max-w-lg text-[0.95rem] leading-7 text-ash">
              Unggah naskah, lihat denah yang terbentuk, lalu buktikan bahwa
              argumenmu bertahan saat setiap klaim diminta pertanggungjawaban.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/upload"
                className="pixel-button pixel-button-shimmer border-gold bg-gold text-void hover:bg-bone"
              >
                Unggah naskah
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
    <header className="sticky top-0 z-30 border-b-2 border-void bg-void/90 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link href="/" className="group hover:opacity-90">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Navigasi utama">
          <a
            href="#cara-main"
            className="hidden px-3 py-1.5 text-[0.76rem] font-bold uppercase tracking-[0.06em] text-ash transition-colors hover:text-bone sm:block"
          >
            Cara main
          </a>
          <a
            href="#imbalan"
            className="hidden px-3 py-1.5 text-[0.76rem] font-bold uppercase tracking-[0.06em] text-ash transition-colors hover:text-bone sm:block"
          >
            Imbalan
          </a>
          <Link
            href="/login"
            className="pixel-button border-ridge bg-tomb px-3 py-1.5 text-[0.76rem] text-bone hover:border-rune"
          >
            Masuk
          </Link>
          <Link
            href="/dashboard"
            className="pixel-button pixel-button-shimmer border-gold bg-gold px-3 py-1.5 text-[0.76rem] text-void hover:bg-bone"
          >
            Mulai
          </Link>
        </nav>
      </div>
    </header>
  );
}

function HeroTorches() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-[2] hidden w-full md:block">
      <div className="absolute left-6 top-1/3 flex flex-col items-center gap-1 lg:left-12">
        <span className="torch-flame" />
        <span className="h-8 w-1.5 bg-[#5b4228] shadow-[2px_0_0_#2c2014]" />
      </div>
      <div className="absolute right-6 top-1/3 flex flex-col items-center gap-1 lg:right-12">
        <span className="torch-flame" />
        <span className="h-8 w-1.5 bg-[#5b4228] shadow-[2px_0_0_#2c2014]" />
      </div>
    </div>
  );
}

function Particles() {
  const items = [
    { left: "10%", bottom: "18%", dur: "7s", delay: "0s", drift: "15px" },
    { left: "22%", bottom: "14%", dur: "9s", delay: "1.2s", drift: "-10px" },
    { left: "38%", bottom: "24%", dur: "6s", delay: "0.5s", drift: "8px" },
    { left: "55%", bottom: "10%", dur: "8s", delay: "2s", drift: "-14px" },
    { left: "70%", bottom: "28%", dur: "7.5s", delay: "0.8s", drift: "12px" },
    { left: "84%", bottom: "16%", dur: "10s", delay: "1.8s", drift: "-8px" },
    { left: "92%", bottom: "22%", dur: "6.5s", delay: "3s", drift: "6px" },
    { left: "47%", bottom: "34%", dur: "8.5s", delay: "1.4s", drift: "-18px" },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
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

function GameScreen() {
  return (
    <div className="relative mx-auto w-full max-w-3xl animate-[game-screen-in_520ms_steps(6,end)_both]">
      <span className="absolute -left-1.5 -top-1.5 h-4 w-4 border-l-2 border-t-2 border-gold" aria-hidden="true" />
      <span className="absolute -bottom-1.5 -right-1.5 h-4 w-4 border-b-2 border-r-2 border-gold" aria-hidden="true" />

      <div className="game-screen shadow-[6px_6px_0_#05080b,0_0_60px_rgba(233,184,93,0.12)]">
        {/* title bar */}
        <div className="flex items-center gap-2 border-b-2 border-void bg-[#111920] px-3 py-2">
          <span className="h-2 w-2 bg-blood/80" />
          <span className="h-2 w-2 bg-gold/80" />
          <span className="h-2 w-2 bg-moss/80" />
          <span className="ml-2 truncate font-pixel text-[0.58rem] text-ash">
            dungeon run · lantai 01 / 06
          </span>
          <span className="ml-auto flex items-center gap-1.5 font-pixel text-[0.58rem] text-gold">
            <span className="h-1.5 w-1.5 animate-flicker bg-moss" />
            LIVE
          </span>
        </div>

        {/* scene */}
        <div className="relative">
          <div className="wall-stone h-8" />
          <div className="tile-floor relative h-52 overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,rgba(233,184,93,0.16),transparent_70%)]" />

            <div className="absolute left-5 top-3 flex flex-col items-center gap-0.5">
              <span className="torch-flame" />
              <span className="h-5 w-1 bg-[#5c3a1e]" />
            </div>
            <div className="absolute right-5 top-3 flex flex-col items-center gap-0.5">
              <span className="torch-flame" />
              <span className="h-5 w-1 bg-[#5c3a1e]" />
            </div>

            {/* hero */}
            <div className="absolute bottom-6 left-[12%] flex flex-col items-center gap-1">
              <PixelSprite
                kind="hero"
                size={64}
                className="animate-bob drop-shadow-[0_5px_0_rgba(0,0,0,0.6)]"
              />
              <span className="font-pixel text-[0.5rem] tracking-[0.1em] text-gold">
                PENJAGA
              </span>
            </div>

            {/* boss silhouette */}
            <div className="absolute bottom-6 right-[11%] flex flex-col items-center gap-1">
              <span className="absolute -top-6 font-pixel text-sm font-bold text-blood damage-pop">
                −24
              </span>
              <PixelSprite
                kind="gap"
                size={70}
                className="animate-floaty drop-shadow-[0_5px_0_rgba(0,0,0,0.6)]"
              />
              <span className="font-pixel text-[0.5rem] tracking-[0.1em] text-ember">
                BOSS · ???
              </span>
            </div>

            {/* door */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="room-door grid h-20 w-14 place-items-center">
                <span className="font-pixel text-[0.5rem] text-gold/80">EXIT</span>
              </div>
            </div>

            {/* damage flash */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_58%,rgba(207,92,104,0.14),transparent_45%)]" />
          </div>
          <div className="wall-stone h-8" />
        </div>

        {/* boss bar */}
        <div className="border-t-2 border-void bg-[#0d141b] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div>
              <p className="font-pixel text-[0.58rem] font-bold text-ember">
                UJIAN · GAP
              </p>
              <p className="font-pixel text-[0.5rem] uppercase tracking-[0.1em] text-ash/60">
                Serangan 2 / 4
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[0.55rem] text-ash">HP</span>
              <div className="flex gap-0.5">
                {[...Array(10)].map((_, i) => (
                  <span
                    key={i}
                    className={`h-3 w-3.5 border border-void ${i < 7 ? "bg-ember" : "bg-ridge/40"}`}
                  />
                ))}
              </div>
              <span className="font-pixel text-[0.55rem] text-ember">72 / 100</span>
            </div>
          </div>
        </div>

        {/* attack panel */}
        <div className="border-t-2 border-void bg-[#0a0f14] px-4 py-4">
          <div className="border border-ridge/50 p-3.5">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center border border-gold/50 bg-void font-pixel text-[0.6rem] text-gold">
                ?!
              </span>
              <p className="font-pixel text-[0.55rem] uppercase tracking-[0.1em] text-gold">
                Serangan penguji
              </p>
            </div>
            <p className="mt-2 text-[0.85rem] leading-6 text-bone">
              “Klaim ini berdiri di atas referensi apa? Tunjukkan bagian naskah
              yang mendukungnya.”
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Klaim", "Bukti", "Batas"].map((hint) => (
                <span
                  key={hint}
                  className="border border-ridge/60 px-2 py-0.5 font-pixel text-[0.5rem] uppercase tracking-[0.08em] text-ash"
                >
                  {hint}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* stats */}
        <div className="grid grid-cols-3 border-t-2 border-void bg-[#111920]">
          <SceneStat label="Nyawa" value="♥ ♥ ♥" tone="text-blood" />
          <SceneStat label="Ruang" value="3 / 7" tone="text-gold" />
          <SceneStat label="Temuan" value="8" tone="text-mana" />
        </div>
      </div>

      <p className="mt-3 flex items-center justify-center gap-2 text-center text-[0.66rem] font-bold uppercase tracking-[0.08em] text-ash/60">
        <span className="h-1.5 w-1.5 animate-flicker bg-ember" />
        Contoh run · setiap temuan jadi ruang
      </p>
    </div>
  );
}

function SceneStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="border-r-2 border-void px-2 py-2 text-center last:border-r-0">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-ash">{label}</p>
      <p className={`mt-1 text-[0.78rem] font-bold ${tone}`}>{value}</p>
    </div>
  );
}
