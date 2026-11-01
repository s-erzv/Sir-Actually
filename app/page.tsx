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
}> = [
  {
    name: "Veylith",
    title: "The Void Stalker",
    domain: "GAP HUNTER",
    line: "Predator kegelapan. Memburu klaim celah riset yang hilang tanpa dukungan referensi.",
    danger: 2,
    sprite: "gap",
    tone: "text-ember",
  },
  {
    name: "Draeven",
    title: "The Dreadfang",
    domain: "THE ALIGNER",
    line: "Binatang buas berkepala dua dengan kehendak berbeda. Mengoyak masalah, tujuan, dan RQ tak selaras.",
    danger: 2,
    sprite: "aligner",
    tone: "text-mana",
  },
  {
    name: "Kryvax",
    title: "The Twisted Brood",
    domain: "METHODOLOGIST",
    line: "Mutasi hasil eksperimen gagal yang terus berevolusi. Menyerang metode yang tidak menjawab RQ.",
    danger: 3,
    sprite: "methodologist",
    tone: "text-moss",
  },
  {
    name: "Morvane",
    title: "The Gravebound",
    domain: "THE AUDITOR",
    line: "Roh ksatria kuno penghakim wilayah. Menghukum kesimpulan yang berani melampaui data temuan.",
    danger: 3,
    sprite: "auditor",
    tone: "text-gold",
  },
  {
    name: "Nyxara",
    title: "The Forgotten Keeper",
    domain: "GHOST LIBRARY",
    line: "Penjaga perpustakaan terkutuk yang menyimpan ingatan dan sitasi fiktif.",
    danger: 2,
    sprite: "references",
    tone: "text-blood",
  },
  {
    name: "Eldravos",
    title: "The Ancient Sovereign",
    domain: "FINAL BOSS",
    line: "Penguasa tertinggi dungeon. Entitas kuno agung yang menguji seluruh perjalanan riset pemain.",
    danger: 3,
    sprite: "sir",
    tone: "text-bone",
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

      <section
        id="main"
        className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10 lg:pb-24 lg:pt-16"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="pixel-chip border-gold/50 bg-gold/10 text-gold">
              Ekspedisi 01 · Research boss battle
            </span>
            <span className="pixel-chip">Save file · dungeon nyata</span>
          </div>

          <h1 className="mt-6 font-pixel text-[1.9rem] font-bold uppercase leading-[1.18] text-bone sm:text-[2.5rem] lg:text-[2.85rem]">
            Naskahmu
            <br />
            <span className="text-gold">punya boss.</span>
          </h1>

          <p className="mt-6 max-w-xl text-[0.98rem] leading-7 text-ash">
            Unggah skripsi, proposal, atau artikel. AI memetakan klaim dan
            referensimu, lalu mengubah kelemahan naskah jadi monster yang harus
            kamu kalahkan dengan argumen.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="pixel-button border-gold bg-gold text-void hover:bg-bone"
            >
              Mulai ekspedisi
              <span aria-hidden="true" className="text-base leading-none">
                ▶
              </span>
            </Link>
            <a
              href="#cara-kerja"
              className="pixel-button border-ridge bg-tomb/80 text-bone hover:border-rune hover:text-gold"
            >
              Lihat alur
            </a>
          </div>

          <div className="mt-9 grid max-w-xl grid-cols-3 gap-2">
            <Stat value="6" label="Boss" />
            <Stat value="3" label="Karakter" />
            <Stat value="5" label="Pos ekspedisi" />
          </div>

          <p className="mt-4 flex items-center gap-2 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-ash/70">
            <span className="h-2 w-2 animate-flicker bg-moss" />
            Naskah → peta → recon → karakter → dungeon
          </p>
        </div>

        <DungeonPreview />
      </section>

      <div className="border-y-2 border-void bg-crypt/80">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-5 py-3 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-ash sm:px-8">
          <span>DOCX / PDF berteks</span>
          <span className="text-ridge" aria-hidden="true">
            ◆
          </span>
          <span>Crossref + OpenAlex</span>
          <span className="text-ridge" aria-hidden="true">
            ◆
          </span>
          <span>Supabase</span>
          <span className="text-ridge" aria-hidden="true">
            ◆
          </span>
          <span>LLM provider-agnostic</span>
        </div>
      </div>

      <section id="cara-kerja" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="eyebrow">Jalur dungeon</p>
            <h2 className="mt-3 font-pixel text-xl font-bold uppercase leading-[1.25] text-bone sm:text-2xl">
              Lima pos. Satu naskah. Banyak alasan.
            </h2>
            <p className="mt-3 max-w-xl text-[0.95rem] leading-7 text-ash">
              Bukan chatbot yang menilai gaya bahasa. Ini ekspedisi yang menuntut
              bukti dari klaim yang benar-benar kamu tulis.
            </p>
          </div>
          <span className="pixel-chip border-gold/40 text-gold">Rute ekspedisi</span>
        </div>

        <div className="relative mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div
            className="absolute left-[8%] right-[8%] top-14 hidden border-t-2 border-dashed border-ridge/80 lg:block"
            aria-hidden="true"
          />
          {STEPS.map((step) => (
            <article key={step.number} className="pixel-panel-soft relative p-4">
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
              <p className="mt-2 text-[0.78rem] leading-5 text-ash">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="bestiary" className="border-y-2 border-void bg-crypt/75">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <p className="eyebrow">Bestiary</p>
              <h2 className="mt-3 font-pixel text-xl font-bold uppercase leading-[1.25] text-bone sm:text-2xl">
                Penghuni dungeon.
              </h2>
              <p className="mt-3 text-[0.95rem] leading-7 text-ash">
                Setiap boss menjaga satu dimensi naskah. Serang dengan argumen
                yang bisa dicek, bukan kalimat yang terdengar meyakinkan.
              </p>
            </div>
            <span className="pixel-chip border-gold/40 text-gold">6 boss menunggu</span>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BOSSES.map((boss, index) => (
              <article
                key={boss.name}
                className={`pixel-panel-soft group overflow-hidden transition-transform duration-150 hover:-translate-y-1 ${
                  boss.sprite === "sir" ? "ring-2 ring-gold/60" : ""
                }`}
              >
                <div className="tile-floor relative flex h-44 items-end justify-center border-b-2 border-void">
                  <span className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l-2 border-t-2 border-gold/40" aria-hidden="true" />
                  <span className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r-2 border-t-2 border-gold/40" aria-hidden="true" />
                  <span className="pointer-events-none absolute bottom-7 left-2 h-3 w-3 border-b-2 border-l-2 border-gold/40" aria-hidden="true" />
                  <span className="pointer-events-none absolute bottom-7 right-2 h-3 w-3 border-b-2 border-r-2 border-gold/40" aria-hidden="true" />
                  <div
                    className="pointer-events-none absolute bottom-10 h-16 w-24 rounded-full bg-gold/15 blur-xl"
                    aria-hidden="true"
                  />
                  <div
                    className="absolute bottom-7 h-3 w-20 bg-black/50 blur-[1px]"
                    aria-hidden="true"
                  />
                  <PixelSprite
                    kind={boss.sprite}
                    size={104}
                    className="relative -mb-1 transition-transform duration-200 group-hover:translate-y-[-6px]"
                  />
                  <span className="absolute right-3 top-3 font-pixel text-[0.6rem] text-ash/80">
                    #{String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-[#05080b]/85 px-3 py-1.5">
                    <span className="font-pixel text-[0.5rem] uppercase tracking-[0.1em] text-ash">HP</span>
                    <span className="h-2 flex-1 border border-void bg-[#0b131c]">
                      <span className="block h-full w-full bg-gradient-to-r from-blood to-ember" />
                    </span>
                    <span className="font-pixel text-[0.5rem] text-blood">100</span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-pixel text-[0.95rem] font-bold text-bone">{boss.name}</h3>
                      <p className="text-xs text-ash/80 italic">{boss.title}</p>
                    </div>
                    <span className={`font-pixel text-[0.6rem] ${boss.tone}`}>
                      {boss.domain}
                    </span>
                  </div>
                  <p className="mt-2 min-h-10 text-sm leading-6 text-ash">{boss.line}</p>
                  <div className="mt-4 flex items-center gap-2 border-t border-ridge/60 pt-3">
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-ash">
                      Ancaman
                    </span>
                    <span className="flex gap-1" aria-label={`Ancaman ${boss.danger} dari 3`}>
                      {[1, 2, 3].map((level) => (
                        <span
                          key={level}
                          className={`h-2 w-5 border border-void ${
                            level <= boss.danger ? "bg-ember" : "bg-ridge/50"
                          }`}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 border-2 border-void bg-[#0a0f14]/90 p-4 shadow-[inset_0_0_0_1px_#34424e]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-pixel text-[0.58rem] text-gold">DUNGEON CREATURES (ANTEK PENJAGA RUANG)</span>
                <p className="mt-0.5 text-xs text-ash">
                  Monster kecil yang menguji setiap ruang temuan sebelum kamu berhadapan dengan Floor Lord:
                </p>
              </div>
              <span className="text-[0.68rem] text-ash/70 font-mono">8 Entitas Minion</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="border border-ridge/60 bg-void/60 px-2.5 py-1 text-bone"><strong>Varkul</strong> · Brutish beast</span>
              <span className="border border-ridge/60 bg-void/60 px-2.5 py-1 text-bone"><strong>Nethrix</strong> · Shadow crawler</span>
              <span className="border border-ridge/60 bg-void/60 px-2.5 py-1 text-bone"><strong>Zorveth</strong> · Armored creature</span>
              <span className="border border-ridge/60 bg-void/60 px-2.5 py-1 text-bone"><strong>Thalgrim</strong> · Stone guardian</span>
              <span className="border border-ridge/60 bg-void/60 px-2.5 py-1 text-bone"><strong>Xyrath</strong> · Winged predator</span>
              <span className="border border-ridge/60 bg-void/60 px-2.5 py-1 text-bone"><strong>Othrak</strong> · Undead warrior</span>
              <span className="border border-ridge/60 bg-void/60 px-2.5 py-1 text-bone"><strong>Velmora</strong> · Cursed spirit</span>
              <span className="border border-ridge/60 bg-void/60 px-2.5 py-1 text-bone"><strong>Grivak</strong> · Small dungeon beast</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        <div className="pixel-panel pixel-panel-gold relative overflow-hidden p-6 sm:p-10">
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

          <div className="relative max-w-2xl md:pr-56">
            <p className="eyebrow">Gerbang terakhir</p>
            <h2 className="mt-3 font-pixel text-xl font-bold uppercase leading-[1.25] text-bone sm:text-2xl">
              Naskahmu sudah siap diuji?
            </h2>
            <p className="mt-3 text-[0.95rem] leading-7 text-ash">
              Unggah naskah, lihat denah yang terbentuk, lalu lihat apakah
              argumenmu bertahan saat setiap klaim diminta pertanggungjawaban.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/upload"
                className="pixel-button border-gold bg-gold text-void hover:bg-bone"
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

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-void bg-void/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link href="/" className="group hover:opacity-90">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-6 font-pixel text-[0.74rem] uppercase tracking-[0.02em] text-ash md:flex">
          <a href="#cara-kerja" className="hover:text-gold">
            Cara main
          </a>
          <a href="#bestiary" className="hover:text-gold">
            Monster
          </a>
          <Link href="/dashboard" className="hover:text-gold">
            Arsip
          </Link>
        </nav>

        <Link
          href="/login"
          className="pixel-button pixel-button-sm border-ridge bg-tomb/80 text-bone hover:border-gold hover:text-gold"
        >
          Lanjutkan
        </Link>
      </div>
    </header>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-2 border-void bg-tomb/75 px-3 py-2 shadow-[inset_0_0_0_1px_#34424e]">
      <p className="font-pixel text-lg font-bold leading-none text-gold">{value}</p>
      <p className="mt-2 text-[0.62rem] font-bold uppercase leading-none tracking-[0.08em] text-ash">
        {label}
      </p>
    </div>
  );
}

function DungeonPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <span
        className="absolute -left-2 -top-2 h-5 w-5 border-l-2 border-t-2 border-gold"
        aria-hidden="true"
      />
      <span
        className="absolute -bottom-2 -right-2 h-5 w-5 border-b-2 border-r-2 border-gold"
        aria-hidden="true"
      />

      <div className="game-screen">
        <div className="game-screen-bar flex items-center justify-between gap-3 px-3 py-2">
          <span className="font-pixel text-[0.58rem] text-gold">Dungeon run 001</span>
          <span className="flex items-center gap-2 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ash">
            <span className="h-2 w-2 animate-flicker bg-ember" />
            Lantai 01
          </span>
        </div>

        <div className="tile-floor relative aspect-[4/3] overflow-hidden">
          <div className="wall-stone absolute inset-x-0 top-0 z-10 h-[16%] border-b-2 border-void" />
          <div className="wall-stone absolute inset-x-0 bottom-0 z-10 h-[13%] border-t-2 border-void" />

          <div className="pointer-events-none absolute left-[1%] top-[8%] z-0 h-[46%] w-[26%] rounded-full bg-[radial-gradient(circle,rgba(233,184,93,0.13),transparent_70%)]" />
          <div className="pointer-events-none absolute right-[1%] top-[8%] z-0 h-[46%] w-[26%] rounded-full bg-[radial-gradient(circle,rgba(233,184,93,0.13),transparent_70%)]" />

          <div className="absolute left-[4%] top-[22%] z-20 flex flex-col items-center">
            <span className="torch-flame" />
            <span className="mt-2 h-7 w-1.5 bg-[#5b4228] shadow-[2px_0_0_#2c2014]" />
          </div>
          <div className="absolute right-[5%] top-[22%] z-20 flex flex-col items-center">
            <span className="torch-flame" />
            <span className="mt-2 h-7 w-1.5 bg-[#5b4228] shadow-[2px_0_0_#2c2014]" />
          </div>

          <div className="absolute right-[3%] top-[31%] z-10 h-[38%] w-[17%] border-4 border-gold/70 bg-[#0b131c] shadow-[inset_0_0_0_3px_#0a0f14,inset_0_0_22px_rgba(233,184,93,0.16)]">
            <div className="absolute inset-x-2 top-2 h-1 bg-gold/20" />
            <div className="absolute inset-x-0 bottom-2 text-center font-pixel text-[0.45rem] text-gold/60">
              EXIT
            </div>
          </div>

          <div className="absolute bottom-[20%] left-[17%] z-20">
            <PixelSprite kind="hero" size={94} title="Ksatria naskah" className="drop-shadow-[0_6px_0_rgba(0,0,0,0.45)]" />
          </div>

          <div className="absolute bottom-[19%] right-[27%] z-20">
            <PixelSprite kind="gap" size={82} title="Veylith — The Void Stalker" className="drop-shadow-[0_6px_0_rgba(0,0,0,0.45)]" />
          </div>

          <div className="absolute bottom-[19%] right-[15%] z-20 opacity-95">
            <PixelSprite kind="sir" size={100} title="Eldravos — The Ancient Sovereign" className="drop-shadow-[0_6px_0_rgba(0,0,0,0.45)]" />
          </div>

          <div className="absolute left-[39%] top-[22%] z-20 w-[37%]">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-pixel text-[0.58rem] text-bone">VEYLITH · GAP HUNTER</span>
              <span className="text-[0.58rem] font-bold text-blood">100 / 100</span>
            </div>
            <div className="h-2.5 border border-void bg-[#080b10] shadow-[inset_0_0_0_1px_#34424e]">
              <div className="h-full w-[72%] bg-blood" />
            </div>
          </div>

          <div className="absolute inset-x-3 bottom-3 z-30 border-2 border-void bg-[#0a0f14]/95 p-2.5 shadow-[inset_0_0_0_1px_#34424e,4px_4px_0_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center border-2 border-void bg-tomb">
                <PixelSprite kind="sir" size={30} />
              </span>
              <div className="min-w-0">
                <p className="font-pixel text-[0.58rem] text-gold">ELDRAVOS · THE ANCIENT SOVEREIGN</p>
                <p className="mt-1 text-[0.78rem] leading-5 text-bone">
                  “Klaim itu belum tentu salah. Tapi belum kamu buktikan di hadapanku.”
                </p>
              </div>
            </div>
          </div>
        </div>

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
