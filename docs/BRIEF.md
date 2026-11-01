# Brief agent: Sir, Actually | Research Boss Battle

Brief ini untuk agent coding yang membangun proyek ini. Baca seluruhnya sebelum mulai M1.

- Sumber: build prompt Maou + PRD (`docs/PRD.md`). Kalau keduanya bertentangan, **build prompt menang**; daftar konflik yang sudah diputuskan ada di bagian 3.
- Skema database **sudah ditulis**: `supabase/migrations/`. Jangan menulis ulang dari nol; ubah lewat migration baru.
- Kerjakan per milestone. Setelah tiap milestone: jalankan, tes, **berhenti**, lapor pakai format di bagian 12. Jangan mulai milestone berikutnya sebelum Maou bilang lanjut.

---

## 1. Produknya

Web game hackathon (Beginner Track, Theme 1: AI-Powered Mini Games). Mahasiswa mengunggah naskah risetnya sendiri; naskah itu jadi **dungeon 2D yang bisa dijelajahi**. Tiap ruang berisi penguji (boss/antek) yang menyerang satu kelemahan naskah lewat pertanyaan. Pemain bertahan dengan jawaban. Hasil akhir: **peta kelemahan**, bukan vonis "layak/tidak layak".

Rasa mainnya harus terasa seperti game dungeon, bukan formulir yang diberi tema: pemain **memilih karakter dan senjata**, tiap karakter punya gaya bertahan dan senjata sendiri, lantai dibentuk dari **dimensi kelemahan naskah** (bukan urutan tetap), **antek-antek bos muncul dulu** sebelum bos lantai, kemenangan memberi **poin dan rank**, dan setiap kalah atau mati menghasilkan **debrief dari AI** yang menyebut bukti naskah. Detail aturan main ada di §13.

Bukan AI detector, bukan penulis ulang naskah, bukan pengganti dosen pembimbing.

Prinsip yang tidak boleh dilanggar:
- **Grounded**: pertanyaan dan penilaian hanya dari Research Map yang sudah dikonfirmasi pemain.
- **Checkable**: setiap kritik menunjuk kutipan persis dari naskah.
- **Rubric-first**: skor dari rubrik tetap; damage dihitung kode, bukan LLM.
- **Pemain tetap penulis**: game tidak pernah menulis kalimat jadi untuk naskah.

## 2. Alur 7 tahap

1. **Context Window**: unggah naskah (.docx / PDF berteks / .md / .txt), konversi ke **Markdown kanonik** di browser, **cek kelengkapan** (bagian 9; naskah tidak lengkap, termasuk tanpa daftar pustaka, tidak bisa lanjut), ekstrak Research Map (masalah, gap, tujuan, RQ, metode, temuan, kesimpulan, keterbatasan, daftar pustaka). Pemain mengedit dan mengonfirmasi. Setelah confirmed, peta beku.
2. **Recon**: detektor kode + LLM (dengan RAG) menghasilkan findings. Job async bertahap dengan layar progres.
3. **Persiapan (Loadout)**: pemain melihat peta kualitas naskah dan memilih **1 karakter + 1 senjata** sebelum turun. Loadout hanya mengubah damage (0,95–1,10), jumlah Heart awal (maks 5), dan petunjuk metadata; tidak pernah mengubah rubrik, level kriteria, atau kebenaran temuan. Detail §13.2.
4. **Dungeon**: lantai dibentuk dari **dimensi kelemahan yang benar-benar ada** di naskah, bukan nomor lantai tetap. **Satu temuan = satu monster**; semua temuan yang bukan boss jadi antek. Monster dipadatkan maksimal 3 per ruang, jadi jumlah ruang tidak meledak. Lantai tanpa temuan dilewati. Jumlah lantai 2–6. Detail §13.3.
5. **Ghost**: perpustakaan terkutuk yang dijaga Nyxara (The Forgotten Keeper / Ghost Library). Pemain menandai 1 referensi palsu yang disisipkan di antara referensi asli.
6. **Sidang akhir**: ruang takhta Eldravos, The Ancient Sovereign (Final Boss / Sir, Actually). Finding rank 1 se-naskah dipakai sebagai fokus konteks; takhta tidak menduplikasi finding itu sebagai monster baru. Gaya penguji Strict / Detail-Oriented / Friendly.
7. **Debrief & Weakness Report**: setiap kalah atau mati memunculkan Catatan Penjaga (per monster) atau Epitaf (Heart habis) yang ditulis AI dari kutipan naskah; setelah run selesai, profil per dimensi (Perlu dibenahi / Cukup / Kuat) + weak links dengan kutipan. Lantai kosong ditulis "tidak ditemukan oleh detektor", bukan "aman".

## 3. Konflik PRD vs build prompt (sudah diputuskan)

| Hal | PRD | Dipakai | Alasan |
|---|---|---|---|
| Skala rubrik | 0-3, skor = rata-rata | **0/1/2 per kriteria, skor = jumlah** (0-6 untuk 3 kriteria) | Build prompt bagian 5 ("PERUBAHAN PENTING") |
| Heart hilang | rata-rata < 1 | **skor ≤ 1** (dari 6) | Build prompt |
| Pertanyaan per monster | sekitar 2 | **boss maks 4 pertanyaan; antek maks 2 pertanyaan per monster** | Build prompt; cegah one-shot dan run terlalu panjang |
| Status encounter | active / won / retried | pending / active / won / conceded / disputed / lost / retried | Kebutuhan alur baru; sudah di migration |
| Research Map | tanpa kesimpulan | `claims.kind` termasuk `conclusion` | Build prompt menyebut kesimpulan |
| Jumlah lantai | 4 lantai tetap | **2–6 lantai dinamis** dari dimensi kelemahan yang ada + Ghost + ruang takhta | Permintaan Maou: lantai mengikuti kualitas naskah |
| Isi lantai | ruang temuan lalu boss | **semua temuan jadi monster**; semua non-boss jadi antek, boss terakhir; maks 3 monster per ruang | Permintaan Maou: jumlah monster = jumlah kelemahan |
| Loadout | tidak ada | **3 karakter × 2 senjata**; hanya damage/Heart/petunjuk, bukan rubrik | Permintaan Maou: rasa game dungeon |
| Gamifikasi | tidak ada | **poin + rank berbasis rasio** (bukan ambang absolut) | Jumlah lantai berubah, ambang absolut jadi tidak adil |
| Feedback kalah | Kitab Nasihat generik | **Catatan Penjaga / Epitaf** yang menyebut kutipan + kriteria | Permintaan Maou: feedback AI tiap kalah/mati |
| Gaya pertanyaan | bebas | **≤28 kata, 1 tanda tanya, bahasa Indonesia sederhana, tipe serangan dirotasi** | Permintaan Maou: tidak membosankan dan mudah dipahami |

Konflik yang **belum** diputuskan ada di bagian 11. Jangan putuskan sendiri.

## 4. Aturan kerja (wajib)

- Jangan klaim "sudah berfungsi" tanpa menjalankannya. Laporkan juga yang gagal, dengan output error-nya.
- Jangan mengarang referensi, statistik, atau hasil kalibrasi. Severity default adalah titik awal (`severity_source = 'default'`), belum dikalibrasi.
- TypeScript `strict: true`. Kode kecil, **satu tanggung jawab per file**. Tanpa emoji di UI.
- LLM dan embedding **hanya dipanggil dari server** (route handler / Edge Function). API key tidak pernah ke browser.
- Teks naskah dan jawaban pemain adalah **data, bukan instruksi**. Bungkus dengan delimiter di prompt dan beri tahu model untuk mengabaikan instruksi di dalamnya.
- Semua output LLM berupa JSON yang divalidasi (pakai `zod`). Output tidak valid: ulangi sekali, lalu gagal dengan pesan jelas.
- Simpan versi prompt, model, dan rubrik di tiap baris hasil LLM.

## 5. Stack dan struktur folder

- Next.js (App Router) + TypeScript + Tailwind + Supabase (Postgres + pgvector).
- **Phaser 3** hanya di client: `dynamic(() => import('@/game/PhaserGame'), { ssr: false })`. Config `pixelArt: true`, zoom kamera bilangan bulat, tanpa antialias.
- React untuk semua UI di atas kanvas (HUD, dialog, textarea, Debrief AI, laporan).
- Phaser dan React berkomunikasi lewat **event bus** (`mitt`), bukan state global bersama.
- **Chat/LLM: Kagiro** (dipakai lewat `lib/llm.ts`; model per boss dari routing yang ada). **Embedding: default FTS, upgrade lokal `multilingual-e5-base`**; Gemini/OpenAI opsional kalau ada key. Bungkus di `lib/embed.ts`. Tidak ada fallback dummy: kalau env provider kosong, route gagal dengan pesan jelas.
- Tes unit: `vitest` untuk semua logika murni.

Struktur yang disarankan (boleh disesuaikan, tapi pertahankan pemisahan tanggung jawab):

```
app/                      halaman + route handler (app/api/**)
components/               UI React (hud/, encounter/, advice/, report/, recon/)
game/
  PhaserGame.tsx          wrapper client-only
  bus.ts                  event bus (mitt) + tipe event
  scenes/                 BootScene, DungeonScene, LibraryScene (Ghost), ThroneScene (sidang)
  map/
    tiles.ts              enum kode tile + mapping ke frame sprite
    generateFloor.ts      planner peta (fungsi murni)
  entities/               Player, Monster
lib/
  balance.ts              SEMUA konstanta HP/damage/jumlah (bagian 7)
  domain/types.ts         tipe Finding, Encounter, JudgeOutput, dst.
  judge/
    validateQuotes.ts     validator kutipan (substring persis)
    rules.ts              aturan deterministik pembatas level
    damage.ts             hitung damage + heart
  recon/                  detektor kode, detektor LLM, validator, ranking, planner
  prompts/                prompt berversi (questioner, judge, report, ghost)
  llm.ts, embed.ts        antarmuka provider
  supabase/               client browser, client server (service role)
  verify/                 Crossref + OpenAlex
public/assets/tiny-dungeon/, public/assets/CREDITS.md
supabase/migrations/      SUDAH ADA
docs/BRIEF.md, docs/PRD.md
```

## 6. Database

File (sudah dites, lihat bagian "Status verifikasi" di bawah):

| File | Isi |
|---|---|
| `20261101000100_init_schema.sql` | 19 tabel (termasuk `recon_jobs`), indeks, RLS, trigger profil, trigger pembeku Research Map, seed katalog, RPC `match_manuscript_chunks` + `search_manuscript_chunks_fts` |
| `20261101000200_update_monster_roster.sql` | Nama dan lore roster monster final |
| `20261101000300_loadout_points.sql` | **Baru**: tabel `characters`, `weapons`, `run_points_events`, `run_debriefs`; kolom loadout/poin/rank di `runs` |
| `20261101000400_rag_permissions.sql` | **Baru**: grant execute RPC retrieval ke `service_role` (R0) |

Menjalankan: `supabase start` + `supabase db reset` (butuh Docker), atau `supabase link` lalu `supabase db push` ke project remote.

Aturan yang harus dipatuhi kode:

1. **Client hanya menulis bahan naskah draft**: `manuscripts`, `research_maps` (status draft, plus konfirmasi draft ke confirmed), `claims`, `citations`, `claim_citations`, dan `pilot_feedback`. **Semua state permainan** (findings, runs, encounters, turns, evaluations, ghost_checks, reports, manuscript_chunks, recon_jobs, run_points_events, run_debriefs) ditulis **server dengan service role**. Katalog `characters`/`weapons` hanya dibaca client; loadout divalidasi server. RLS sudah memblok client, jadi HP/Heart tidak bisa dicurangi dari browser.
2. **`citations` dari client wajib select kolom eksplisit**: `select('id, research_map_id, raw_text, parsed, created_at')`. `select('*')` akan error **permission denied**. Kolom `is_injected`, `verification_status`, `matched_work` sengaja disembunyikan karena membocorkan jawaban Ghost (referensi sisipan pasti `not_found`). Server mengirim status verifikasi setelah tahap Ghost selesai.
3. **Research Map confirmed beku** (trigger). Revisi naskah = `research_maps` versi baru (`version + 1`), bukan update. Di peta confirmed, yang boleh: update `citations.verification_status / matched_work / verified_at`, dan insert satu citation `is_injected = true` (Ghost).
4. **`research_maps` dari client**: insert hanya kolom `manuscript_id, version, source_text`; update hanya `status, confirmed_at` (konfirmasi). Kolom `completeness` **hanya ditulis server** (kalau client bisa mengisinya, cek kelengkapan bisa dilewati). Trigger menolak konfirmasi kalau tidak ada daftar pustaka (citation non-sisipan), `completeness` masih null, atau `completeness.missing` tidak kosong.
5. Satu run `active` per Research Map (unique index). Revisi: set run lama `closed_revised`, buat run baru dengan `previous_run_id`.
6. **Embedding**: `manuscript_chunks.embedding` **sudah** `vector(768)` di migration init; jangan menambah migration dimensi. Indeks HNSW **belum** dipakai (naskah puluhan–ratusan chunk); tambah hanya kalau p95 retrieval >200 ms. Selalu isi `embedding_model`; RPC menyaring per model. Detail `docs/RAG-PLAN.md`.
7. Operator pgvector ada di schema `extensions`. Di SQL dengan `search_path = ''`, tulis `operator(extensions.<=>)`.
8. Fallback FTS memakai config `'simple'` karena config `indonesian` belum diuji di Postgres sungguhan. Jangan mengganti berdasarkan dugaan.
9. Fungsi trigger yang membaca kolom tersembunyi (`citations.is_injected`) harus `security definer`, karena trigger jalan sebagai role pemanggil (`authenticated`). Bug ini sempat ada dan tertangkap tes.
10. Hapus naskah: soft delete (`deleted_at`) menyembunyikan semua turunan; hard delete men-cascade semuanya.

Status verifikasi migration: dijalankan di PGlite 0.3.4 (Postgres WASM + pgvector) dengan stub `auth.users`, `auth.uid()`, dan role Supabase. Lolos: 19 tabel tercipta, seed lengkap, isolasi antar-user, column grants, blok tulis state permainan dari client, unique index, check constraint, soft/hard delete cascade, RPC vektor dan FTS. Tabel loadout/poin/debrief di atas **belum** ditulis; itu pekerjaan M2b/M3. Trigger pembeku terbukti terpicu, tapi **teks pesan error-nya tidak bisa dicek** karena PGlite crash di setiap `raise exception` (bug PGlite, bukan migration). **Belum dites di Supabase sungguhan**: jalankan `supabase db reset` sekali di M3 dan laporkan hasilnya.

## 7. Aturan game dan balance

### Roster Monster & Hierarki Penamaan (Universe Dark Fantasy Original)

Sir, Actually mengusung semesta dark fantasy original dengan fonetik konsisten: dark, ancient, alien, dan berkarakter kuat.

#### Naming Hierarchy
```
# ELDRAVOS (THE ANCIENT SOVEREIGN) — Final Boss
│
├── The Four Dungeon Lords (dipetakan per dimensi, bukan nomor lantai tetap)
│   ├── Veylith — The Void Stalker (Gap Hunter)
│   ├── Draeven — The Dreadfang (The Aligner)
│   ├── Kryvax — The Twisted Brood (Methodologist)
│   └── Morvane — The Gravebound (The Auditor)
│
├── The Forgotten Keeper (selalu ada)
│   └── Nyxara — The Forgotten Keeper (Ghost Library)
│
└── Dungeon Creatures (Minions)
    ├── Varkul   — Brutish beast
    ├── Nethrix  — Shadow crawler
    ├── Zorveth  — Armored creature
    ├── Thalgrim — Stone guardian
    ├── Xyrath   — Winged predator
    ├── Othrak   — Undead warrior
    ├── Velmora  — Cursed spirit
    └── Grivak   — Small dungeon beast
```

#### Detail 6 Boss Utama
1. **01. Veylith**
   - **Gelar**: The Void Stalker
   - **Peran / Dimensi**: Gap Hunter (dimensi Gap)
   - **Deskripsi**: Predator dari kegelapan yang memburu sesuatu yang hilang. Menyerang klaim celah riset yang tidak memiliki fondasi literatur pendukung.
2. **02. Draeven**
   - **Gelar**: The Dreadfang
   - **Peran / Dimensi**: The Aligner (dimensi Align)
   - **Deskripsi**: Binatang buas yang memiliki dua kepala dengan kehendak berbeda. Mengoyak inkonsistensi antara rumusan masalah, tujuan penelitian, dan pertanyaan penelitian (RQ).
3. **03. Kryvax**
   - **Gelar**: The Twisted Brood
   - **Peran / Dimensi**: Methodologist (dimensi Method)
   - **Deskripsi**: Makhluk hasil mutasi yang terus berevolusi melalui eksperimen gagal. Menguji validitas metodologi, kecukupan ukuran sampel, dan batasan generalisasi.
4. **04. Morvane**
   - **Gelar**: The Gravebound
   - **Peran / Dimensi**: The Auditor (dimensi Audit)
   - **Deskripsi**: Roh ksatria kuno yang menghakimi siapa pun yang memasuki wilayahnya. Menghukum kesimpulan yang berani melompat melampaui data temuan empiris.
5. **05. Nyxara**
   - **Gelar**: The Forgotten Keeper
   - **Peran / Dimensi**: Ghost Library (selalu ada)
   - **Deskripsi**: Penjaga perpustakaan terkutuk yang menyimpan ingatan dan kitab palsu. Menyisipkan sitasi fiktif yang harus diidentifikasi oleh pemain.
6. **06. Eldravos**
   - **Gelar**: The Ancient Sovereign
   - **Peran / Dimensi**: Final Boss (Ruang Takhta, selalu ada)
   - **Deskripsi**: Penguasa tertinggi dungeon. Entitas kuno agung yang menguji seluruh perjalanan dan mata rantai riset pemain secara holistik.

> [!NOTE]
> Nama-nama ini adalah rancangan kreatif universe fantasy original. Sebelum publikasi/rilis komersial, lakukan pengecekan nama dan trademark.

#### Minions (Dungeon Creatures)
Monster kecil yang muncul di ruangan sebelum boss lantai:
| Nama | Karakter | Peran / Lore |
| --- | --- | --- |
| **Varkul** | Brutish beast | Makhluk buas perkasa berotot kekar penantang argumen awal |
| **Nethrix** | Shadow crawler | Perayap bayangan pengintai celah sitasi tersembunyi |
| **Zorveth** | Armored creature | Monster berlapis baja tebal penahan logika prematur |
| **Thalgrim** | Stone guardian | Penjaga gerbang batu kuno yang kokoh dan tak kenal ampun |
| **Xyrath** | Winged predator | Predator bersayap penyergap inkonsistensi metodologis |
| **Othrak** | Undead warrior | Prajurit mayat hidup pelindung integritas sampel |
| **Velmora** | Cursed spirit | Roh terkutuk peratap generalisasi yang berlebihan |
| **Grivak** | Small dungeon beast | Binatang buas kecil lincah pengacau klaim kesimpulan |

### Komposisi lantai dinamis

Lantai **bukan** urutan tetap 1–4. `buildFloorPlan(findings, hasReferences)` (fungsi murni, bertes) mengubah findings menjadi rencana lantai:

1. Kelompokkan findings per **dimensi**: gap, align, method, audit. Ghost selalu ada selama daftar pustaka ada. Ruang takhta selalu ada.
2. Lantai penelitian hanya dibuat untuk dimensi yang **punya minimal 1 finding**. Dimensi kosong dilewati, tidak digenerate.
3. Urutkan lantai penelitian dari **severity rata-rata terendah → tertinggi** (tie-break: centrality, lalu urutan tetap gap → align → method → audit). Ghost dan Ruang Takhta selalu di akhir. Jadi makin dalam lantai, makin berat; nomor lantai tidak lagi identitas dimensi.
4. `floorCount = jumlahDimensiAktif + Ghost + RuangTakhta`, minimum 2, maksimum 6.
5. Tiap lantai:
   - **Boss** = finding dengan **rank terkecil** (rank 1 = paling berat) di dimensi itu.
   - **Antek** = **semua** finding lain di dimensi itu, diurut rank besar → kecil (ringan → berat). Antek memakai rubrik penuh dan bisa memotong Heart. Tidak ada batas jumlah antek.
   - **Monster = finding.** Kalau satu dimensi cuma punya 1 finding, monster itu langsung boss; tidak ada antek karena tidak boleh mengarang temuan atau menduplikasi finding.
   - **Pemadatan ruang:** maksimal **3 monster per ruang**. Jumlah ruang antek = `ceil(jumlahAntek / 3)`; boss tetap 1 ruang terakhir. Contoh: 14 antek = 5 ruang antek (3+3+3+3+2) + 1 ruang boss.
   - **Tidak ada overflow.** Semua finding masuk dungeon dan laporan; tidak ada temuan yang dibuang karena cap.
6. Urutan boss mengikuti **dimensi**, bukan nomor lantai. Jangan memakai `bosses.floor_order` sebagai kunci tunggal; simpan `dimension` dan tampilkan nomor lantai sesuai run. AI hanya boleh **mengusulkan** urutan; kode yang menghitung dan mengunci.
7. Confidence < `LOW_CONFIDENCE`: ruang antek bersifat opsional; melewatinya tidak memblokir pintu boss, tetapi tercatat "belum diuji".

**Tingkat kualitas dungeon** (label dan kesulitan, bukan mengarang temuan):

| Tier | Kondisi | Lantai | Efek main |
|---|---|---|---|
| **Kokoh** | 0–1 dimensi penelitian, tidak ada severity 3 | 2–3 | antek 1 per lantai, pertanyaan langsung |
| **Retak** | 2–3 dimensi, atau 1 severity 3 | 4–5 | antek = jumlah finding, boss memakai rubrik penuh |
| **Rapuh** | 4 dimensi, atau ≥2 severity 3 | 6 | semua temuan jadi monster, ruang dipadatkan 3 per ruang, campuran tipe serangan |

### Taksonomi (seed di `weakness_types` & `bosses`)

Dimensi (dipetakan ke boss, bukan nomor lantai tetap):
- **Gap — Veylith** (Gap Hunter): `gap_unsupported`, `gap_answered_by_own_refs`, `claim_without_citation`.
- **Align — Draeven** (The Aligner): `problem_objective_gap`, `objective_rq_mismatch`.
- **Method — Kryvax** (Methodologist): `rq_method_mismatch`, `sample_unreported`, `generalization_beyond_sample`, `limitation_missing`.
- **Audit — Morvane** (The Auditor): `conclusion_overclaim`, `objective_without_finding`, `abstract_result_mismatch`.
- **Ghost — Nyxara** (Ghost Library / The Forgotten Keeper): `citation_not_found`, `citation_claim_mismatch` (status `needs_review`, tanpa biaya Heart, hanya saran di laporan).
- **Throne — Eldravos** (Final Boss / The Ancient Sovereign): pengujian puncak seluruh mata rantai riset.
Bentuk serangan yang boleh per tipe ada di `weakness_types.attack_types`.

### Urutan dan pemetaan
- Rank = urut severity desc, centrality desc, confidence desc. Tanpa skor desimal; **rank 1 = paling berat**.
- Ruang di satu lantai = antek dulu (rank besar → kecil), **boss terakhir** (rank 1).
- Boss takhta memakai finding rank 1 se-naskah sebagai **fokus konteks**, bukan monster duplikat. Kalau Recon kosong: sidang akhir memakai klaim sentral Research Map, tidak mengarang temuan.
- Tidak ada cap jumlah monster/ruang. Jumlah ruang dihitung dari pemadatan 3 monster per ruang.
- Confidence rendah = ruang opsional, bukan tuduhan.
- Batas kode: kelemahan pada klaim yang bukan RQ, temuan utama, atau kesimpulan dibatasi severity maks 2.

### Konstanta di `lib/balance.ts` (sudah disetujui Maou, ditala setelah playtest)

```ts
export const HEARTS_START = 3;            // baseline; loadout bisa menaikkan, maks HEART_MAX
export const HEART_MAX = 5;
export const BOSS_HP = 100;
export const MINION_HP = 100;
export const HIT_CAP = { boss: 0.45, minion: 0.6 } as const; // fraksi HP dasar per jawaban
export const HIT_CAP_CEILING = { boss: 0.49, minion: 0.66 } as const; // batas keras setelah bonus
export const HEART_LOSS_MAX_SCORE = 1;    // skor <= 1 kehilangan 1 Heart
export const MAX_QUESTIONS_BOSS = 4;
export const MAX_QUESTIONS_MINION = 2;
export const MONSTERS_PER_ROOM_MAX = 3;   // pemadatan ruang, bukan cap jumlah monster
export const MAX_FLOORS = 6;              // 4 dimensi penelitian + Ghost + ruang takhta
export const LOW_CONFIDENCE = 0.5;        // di bawah ini ruang jadi opsional
export const WEAPON_DAMAGE_BONUS_MIN = 0.95;
export const WEAPON_DAMAGE_BONUS_MAX = 1.10;
// Poin gamifikasi — TIDAK dikalibrasi, titik awal playtest. Detail §13.5.
export const POINTS_MINION_WON = 20;
export const POINTS_BOSS_WON = 40;
export const POINTS_FLOOR_CLEARED = 100;
export const POINTS_FLAWLESS = 50;
export const POINTS_NO_HEART_LOST = 30;
export const POINTS_STREAK_STEP = 10;
export const POINTS_STREAK_MAX = 20;
export const RANK_RATIO = { S: 0.85, A: 0.70, B: 0.50 } as const;
```

Rumus (kode, bukan LLM):

```
effectiveCap = min(HIT_CAP[kind] × weaponBonus, HIT_CAP_CEILING[kind])
damage = floor(scoreTotal / scoreMax × effectiveCap × hpMax)
```

Cek: boss maks 49 per jawaban (butuh minimal 3 jawaban, maks 4 pertanyaan), antek maks 66 (butuh 2 jawaban bagus, maks 2 pertanyaan). Karena damage sebanding dengan `hpMax`, angka HP hanya tampilan; yang menentukan jumlah jawaban adalah `HIT_CAP` + ceiling. Setelah batas pertanyaan monster tercapai dan HP > 0: encounter `conceded`, temuan `conceded`, skor tercatat. HP 0: `won`, temuan `defended`.

`weaponBonus` (0,95–1,10) hanya mengalikan damage, **tidak pernah** menyentuh level kriteria, `scoreTotal`, atau `scoreMax`. Hasil akhir selalu di-clamp ke `HIT_CAP_CEILING[kind]` supaya satu jawaban sempurna tidak pernah membunuh boss dalam sekali serangan. Detail loadout di §13.2. Poin **tidak pernah** mengubah damage, rubrik, atau hasil encounter; poin hanya untuk rank dan kosmetik.

### Objection!
Pemain menandai temuan salah. Encounter dan temuan jadi `disputed`, catatan pemain ke `findings.dispute_note`, **tidak** memotong Heart, ruang dianggap selesai (pintu terbuka). Dicatat untuk kalibrasi.

### Heart habis
Encounter `lost`, tampilkan Catatan Penjaga (bagian 9), lalu pemain memilih: **ulangi lantai** (encounter lama `retried`, buat ulang dengan bentuk serangan yang belum dipakai) atau **perbaiki naskah** (alur revisi, bagian 9).

## 8. Penilaian jawaban (Judge bertingkat)

Pipeline per jawaban pemain, urut:

1. **LLM Judge** mengembalikan JSON saja:
   ```json
   { "criteria": [{ "id": "sample_justified", "level": 1, "quote": "5 responden" }], "missing": "..." }
   ```
   Level 0 = tidak ada; 1 = disebut tanpa alasan/bukti; 2 = disebut dan didukung alasan/angka/rujukan ke naskah. Judge wajib menyebut satu kekurangan (`missing`), merujuk kutipan pemain. Judge menilai dukungan bukti dan konsistensi internal, **bukan kebenaran fakta domain**.
2. **Validator kutipan** (`lib/judge/validateQuotes.ts`): `quote` harus substring persis dari jawaban pemain (normalisasi whitespace saja). Tidak valid atau kosong = level 0. Kriteria yang tidak dikembalikan = 0. Kriteria yang tidak ada di rubrik dibuang.
3. **Rules engine** (`lib/judge/rules.ts`): aturan deterministik yang **membatasi** level (tidak pernah menaikkan). Tiap pembatasan dicatat di `evaluations.rule_caps`. Angka diambil dari `research_maps.source_text`; kalau naskah tidak menyebut, dari jawaban pemain. Minimal:
   - `sample_unreported` / `sample_justified`: n < 30 dan analisis korelasi/regresi, maka maks level 1, meski pemain bilang "cukup".
   - n tidak bisa ditemukan sama sekali (naskah maupun jawaban), maka `sample_justified` maks 0.
   - p-value > 0,05 tapi jawaban/kesimpulan menyebut "signifikan", maka `no_overclaim` maks 0.
   - Angka (n, p, r, R², persen) di jawaban yang bertentangan dengan angka di naskah, maka `numbers_consistent` maks 0; angka yang tidak ada di naskah sama sekali, maka maks 1.
   - Jawaban merujuk referensi yang tidak ada di `citations`, maka `gap_supported` maks 1.
   - Klaim kausal ("menyebabkan", "pengaruh", "dampak", "causes") dengan desain korelasional, maka `no_overclaim` maks 1.

   Tiap aturan: satu fungsi murni + tes unit dengan contoh lulus dan gagal.
4. **Damage dan Heart** (`lib/judge/damage.ts`): rumus bagian 7.
5. **Tampilkan ke pemain**: bar skor (mis. 3/6), level per kriteria (0/1/2), satu kalimat `missing` yang merujuk kutipan pemain. Contoh: "Kamu menyebut 5 responden, tapi belum menjelaskan kenapa 5 cukup untuk korelasi."
6. Simpan ke `evaluations`: `scores` (setelah validasi dan cap), `raw_judge_output`, `rule_caps`, `score_total`, `score_max`, `damage`, `heart_lost`, `missing`, `judge_model`, `prompt_version`, `rubric_id`.

Tes wajib (M2): jawaban asal "5 responden, dipilih acak, menurut saya cukup" pada `sample_unreported` **tidak boleh** membunuh boss dalam satu serangan dan **tidak boleh** dapat level 2 di `sample_justified`.

### Questioner
- Input: temuan + `evidence_quote`, Research Map confirmed, persona boss, `attack_type` yang dipilih planner, daftar pertanyaan sebelumnya di temuan ini.
- Planner (kode) memilih `attack_type` dari `weakness_types.attack_types` yang **belum dipakai di ruang ini** (lihat `turns`). Simpan `question_hash` (hash teks yang dinormalisasi).
- Kalau semua bentuk sudah terpakai (tipe dengan 2-3 bentuk, sementara boss bisa sampai 4 pertanyaan dan antek 2): bentuk **boleh diulang**, asalkan tidak sama dengan bentuk pertanyaan sebelumnya (tidak berturut-turut) dan `question_hash` belum pernah dipakai di temuan ini. Hash bentrok: minta Questioner membuat ulang sekali.

### Gaya pertanyaan (wajib)

Pertanyaan adalah **serangan**, bukan kuis. Aturan yang dicek kode sebelum pertanyaan dikirim ke layar:

- **Bahasa Indonesia sederhana**, sapaan "kamu", maksimal **28 kata** dan **satu tanda tanya**. Tanpa jargon yang tidak dijelaskan. Tanpa emoji.
- **Bukan pertanyaan ya/tidak.** Mulai dengan "Jelaskan", "Bagaimana", "Di bagian mana", "Berapa", "Apa yang terjadi jika", atau "Mana yang paling lemah".
- **Satu sasaran**: satu kriteria rubrik untuk antek, maksimal dua untuk boss. Pertanyaan harus menyebut konteks temuan tanpa memberi jawaban.
- **Tipe serangan dirotasi** oleh planner: `clarify`, `challenge`, `counterexample`, `numbers`, `limitation`, `spot`, `scenario`, `repair`. Tipe yang sudah dipakai di ruang itu tidak dipakai lagi sampai semua tipe habis.
- **Tidak mengulang permukaan kalimat**: `question_hash` unik per finding; dalam satu lantai, dua pertanyaan tidak boleh dibuka dengan pola yang sama. Cek kemiripan trigram; jika > 0,85 minta Questioner menulis ulang sekali.
- **Fallback deterministik**: tiap tipe punya minimal 5 templat Indonesia di `lib/prompts/questioner_v1.ts`. Kalau LLM gagal atau mengulang, templat dipakai dan dicatat `question_source = 'template'`; permainan tidak berhenti.
- **Boss boleh punya satu kalimat persona** di awal ruang, bukan di setiap pertanyaan. Persona tidak boleh menambah ancaman atau mengarang bukti.
- **Tingkat kesulitan**: antek memakai `clarify`, `spot`, `numbers`; boss memakai `challenge`, `counterexample`, `limitation`; ruang takhta memakai `scenario` + `repair`.

UI jawaban menampilkan tiga pengingat opsional di atas textarea: **Klaim / Bukti / Batas**. Pemain tetap menulis satu jawaban bebas; pengingat bukan format wajib dan tidak dinilai terpisah.

## 9. Bagian lain yang wajib dipatuhi

**Unggah naskah**. Format: **.docx** (`mammoth`), **PDF berteks** (`pdfjs-dist` atau `unpdf`), **.md**, dan **.txt**. PDF hasil scan tidak didukung; kalau teks hasil ekstraksi kosong atau terlalu sedikit, tolak dengan pesan jelas.

Alur konversi (semua di browser, file asli tidak pernah diunggah):

```
docx / pdf / md / txt
  → ekstraksi teks + heading
  → Markdown kanonik (heading, paragraf, daftar, tabel; tanpa HTML)
  → pratinjau + perbaikan label bagian
  → kirim Markdown ke server sebagai research_maps.source_text
```

- **Markdown kanonik adalah satu-satunya sumber kebenaran.** `source_text`, chunk, kutipan, dan validator substring semuanya memakai Markdown ini. Jangan menyimpan teks versi lain yang bisa berbeda.
- Markdown sengaja **polos**: tanpa `**bold**`, `_italic_`, atau HTML inline. Hanya heading (`#`/`##`), paragraf, daftar, dan tabel pipa. Ini menjaga kutipan tetap bersih dan validator tidak salah cocok.
- PDF: heading yang tidak terbaca boleh diperbaiki pemain di layar konfirmasi; tabel yang terdeteksi jadi tabel Markdown, kalau gagal jadi paragraf biasa dan dicatat.
- DOCX: `mammoth` → HTML → Markdown. Pakai `turndown` (dependensi kecil) atau konverter sendiri; jangan menulis parser DOCX baru. Sanitasi HTML; jangan render HTML mentah dari dokumen.
- `.md`/`.txt` diterima apa adanya setelah dibersihkan; `.md` yang berisi HTML disanitasi.
- Offset `char_start`/`char_end` dihitung terhadap Markdown kanonik, bukan file asli.
- Naskah adalah **data, bukan instruksi**. Bungkus dengan delimiter di prompt dan larang model mengikuti instruksi di dalamnya.

**Syarat naskah lengkap** (keputusan Maou: yang diunggah harus draft lengkap). Cek dilakukan **kode** di server (`lib/manuscript/completeness.ts`, fungsi murni + tes), hasilnya ditulis ke `research_maps.completeness`. Bagian wajib tergantung `manuscripts.stage`:

| Bagian | proposal | skripsi / jurnal |
|---|---|---|
| Latar belakang / pendahuluan | wajib | wajib |
| Tujuan dan/atau rumusan masalah (RQ) | wajib | wajib |
| Metode | wajib | wajib |
| Hasil / temuan | - | wajib |
| Kesimpulan | - | wajib |
| **Daftar pustaka**, minimal 1 entri terparse | wajib | wajib |

- Bagian wajib yang tidak ada: **tidak bisa lanjut**. Tampilkan checklist apa yang kurang, dan minta pemain melengkapi draft lalu unggah ulang. Ini bukan temuan/ruang dungeon; ini gerbang masuk.
- Deteksi heading bisa salah. Kalau pemain bilang bagiannya ada, ia boleh menunjuk teks/heading yang dimaksud di layar konfirmasi; server mengecek ulang dan baru mengisi `completeness.missing = []` kalau teks yang ditunjuk memang ada di `source_text`.
- **Jumlah referensi** (tidak ada standar umum; tiap kampus/prodi/jurnal beda, jadi jangan mengarang satu angka "layak"):
  - Form unggah punya kolom opsional **"Minimal referensi menurut pedoman kampus/jurnalmu"** (`manuscripts.min_references`).
  - **Diisi**: syarat keras. `count < min_references` masuk `completeness.missing` (`references_min`), pemain tidak bisa lanjut, pesan menyebut angka dari pedomannya sendiri.
  - **Kosong**: pakai `DEFAULT_MIN_REFERENCES[stage]` dari `lib/balance.ts`. Kurang dari itu **tidak memblokir**; masuk `completeness.warnings` (`references_below_default`) dan tampil sebagai peringatan di Weakness Report dengan label "angka default, belum dikalibrasi; cek pedoman kampusmu".
  - `count` = jumlah entri daftar pustaka yang berhasil terparse, tanpa referensi sisipan Ghost. Tampilkan angkanya ke pemain di layar konfirmasi supaya salah parse bisa terlihat.
  - Ini **bukan** temuan dan tidak jadi ruang dungeon: jumlah referensi bukan soal mata rantai logika riset.
  - Kalau `min_references` diubah setelah cek, server menghitung ulang `completeness`.
- **Keterbatasan tidak wajib** di gerbang: ketiadaannya adalah temuan `limitation_missing` di lantai Methodologist (Kryvax).
- Database ikut menjaga: trigger menolak konfirmasi tanpa citation, dengan `completeness` null, atau dengan `missing` yang tidak kosong.
- Karena daftar pustaka selalu ada, **tahap Ghost selalu dimainkan**.

**Debrief AI** (menggantikan "Kitab Nasihat" generik). Dipicu tiap encounter `lost` atau `conceded` (**Catatan Penjaga**) dan saat Heart habis (**Epitaf**). Isi wajib:

1. **Yang tadi kurang** — satu kalimat, merujuk kriteria rubrik yang dapat level 0/1 dan potongan jawaban pemain.
2. **Bukti yang belum kamu pakai** — satu kutipan persis dari `source_text` atau chunk yang di-retrieve, dengan label bagian. Bukan paragraf baru dan bukan tulis ulang.
3. **Satu pertanyaan balik** — pertanyaan yang harus dijawab penulis sendiri; bukan kalimat pengganti.
4. **Saran taktis** — misalnya "coba Mira + Busur Angka" hanya kalau loadout itu cocok dengan kelemahan; jelaskan bahwa loadout tidak mengubah penilaian.
5. Disclaimer "bukan pengganti dosen pembimbing" selalu tampil.

Aturan grounding: setiap kalimat faktual harus punya `finding_id`, `criterion_id`, atau `quote`; validator cek kutipan ada di `source_text`. Dilarang menyebut sitasi atau angka yang tidak ada di naskah. LLM gagal atau kutipan tidak valid: pakai templat deterministik, catat `advice_source = 'template'`. Simpan per monster di `encounters.advice` + `advice_prompt_version`; Epitaf run disimpan di `run_debriefs` (detail §13.6).

**Recon**. Langkah: chunk (per heading, sekitar 200-400 kata) → embed → detektor kode → verifikasi referensi (Crossref per DOI, OpenAlex) → detektor LLM per klaim dengan retrieval (top-k + potongan dari bagian yang sama) → validator (`evidence_quote` harus substring persis dari chunk yang diambil; kalau tidak, buang dan hitung di `recon_jobs.discarded`) → severity/centrality → ranking → planner. Tiap eksekusi mengerjakan satu langkah (atau satu batch) lalu menyimpan `cursor`; batas Edge Function gratis 150 dtk wall-clock / 2 dtk CPU. Catat durasi per langkah di `recon_jobs.timings`; waktu Recon belum pernah diukur, jadi laporkan angkanya.

**Ghost**. Ghost generator (LLM) menulis 1 referensi palsu yang masuk akal (pola: nama jurnal asli, judul artikel yang tidak ada). Verifier harus **gagal** menemukannya di Crossref dan OpenAlex; kalau ketemu, buang dan buat ulang. Sisipkan sebagai `citations.is_injected = true`. Pemain berinteraksi dengan buku di perpustakaan untuk menandai. Simpan ke `ghost_checks` (`hit`, `duration_ms`). Referensi asli yang `not_found` = `needs_review`, tanpa biaya Heart.

**Revisi naskah di tengah run**. Run lama `closed_revised` → Research Map versi baru → run baru (Heart reset) → Recon penuh. Perbandingan deterministik di `reports.comparison`:
- tipe sama dan `evidence_quote` lama masih ada di `source_text` baru: **"masih ada"**
- kutipan lama hilang: **"berubah, belum tentu beres"** (tidak pernah "sudah beres")
- temuan tanpa padanan di run lama: **"baru"**

**Privasi**. Sebelum unggah, tampilkan peringatan bahwa teks naskah dikirim ke penyedia LLM (Kagiro) untuk ekstraksi/tanya-jawab. Kalau embedding lokal dipakai, teks tidak keluar untuk embedding; kalau Gemini/OpenAI dipakai, sebutkan juga. Sediakan tombol hapus naskah.

## 10. Peta dungeon (inti permintaan)

Harus denah sungguhan, bukan layar form.

- `buildFloorPlan(findings, hasReferences): FloorPlan[]` dan `generateFloor(roomPlan, floorOrder, seed): FloorMap` adalah **fungsi murni**, deterministik untuk seed yang sama, dengan tes unit.
- Output: `tiles: number[][]` (kode tile dari enum: WALL, FLOOR, DOOR_LOCKED, DOOR_OPEN, STAIRS, TORCH, TORCH_RED, DECOR), plus daftar `rooms` (`{ id, findingId, rect, isBoss, monsterSpawn }`), `playerSpawn`, `stairs`. Bentuk datanya dibuat mirip layer Tiled supaya nanti bisa diganti peta Tiled.
- Layout: lorong horizontal dengan N ruang berurutan (`N = ceil(jumlahAntek / 3) + 1 boss`), ruang terakhir = ruang boss lebih besar, tangga di ujung ruang boss. Satu ruang bisa berisi maksimal 3 monster; pintu ruang terbuka setelah semua monster di ruang itu selesai. Kalau dimensi hanya punya 1 finding, monster itu langsung boss (§7).
- Pintu antar ruang terkunci sampai temuan di ruang sebelumnya selesai (defended / conceded / disputed).
- Lantai tanpa temuan penelitian tidak digenerate; Ghost dan ruang takhta tetap ada. Jumlah lantai 2–6, mengikuti §7 dan §13.3.
- Ruang awal (camp/loadout) menampilkan **rak senjata** dan **pilihan karakter** sebelum pintu pertama. Pilihan dikirim ke server; server memvalidasi dan menyimpan di `runs`, bukan di state browser.
- Render lewat Phaser Tilemap dari array (tanpa editor Tiled di MVP).
- Pemain: gerak per-tile dengan tween halus, tabrakan dinding. Panah/WASD di desktop, D-pad di layar untuk HP.
- Monster tampil di ruangnya. Berjalan ke monster/pintu memicu **encounter**: event bus mengirim `encounter:start`, React menampilkan overlay (dialog boss, kutipan naskah, textarea). Peta tetap terlihat di belakang; boss bergetar saat kena damage (`boss:hit`). Input gerak Phaser dimatikan selama overlay terbuka.
- Setelah kalah: overlay **Catatan Penjaga** menggantikan layar skor; setelah Heart habis: **Epitaf** + pilihan ulangi lantai / ganti loadout untuk run baru.
- Kamera mengikuti pemain. Ruang boss lebih gelap dengan obor merah.
- Minimap di pojok: ruang selesai, ruang saat ini, ruang boss tersembunyi sampai dibuka, ikon antek yang belum dilawan.
- Ghost = perpustakaan terkutuk Nyxara (`LibraryScene`), sidang akhir = ruang takhta Eldravos (`ThroneScene`).

**Aset**: Kenney "Tiny Dungeon" (CC0) dari https://kenney-assets.itch.io/tiny-dungeon ke `public/assets/tiny-dungeon/`. **Cek ukuran tile dari file yang diunduh, jangan menebak.** Sprite tambahan hanya CC0 (Kenney lain, OpenGameArt filter CC0). Tiap aset dicatat di `public/assets/CREDITS.md` (nama, URL, lisensi). Mapping sprite: Veylith (Gap Hunter), Draeven (Aligner), Kryvax (Methodologist), Morvane (Auditor), Nyxara (The Ghost), Eldravos (The Ancient Sovereign / Sir Actually - paling besar/menonjol); kunci sprite sudah ada di `bosses.sprite_key`. Tiga karakter memakai sprite hero yang sama dengan warna palet berbeda di MVP; senjata tampil sebagai ikon di HUD, bukan animasi terpisah. Suara default mati, ada tombol nyala.

# Patch untuk docs/BRIEF.md: ganti seluruh bagian 11

Tempel menggantikan "## 11. Keputusan terbuka" sampai sebelum "## 12". Keputusan di bawah diambil 30 Okt 2026 atas permintaan Maou ("putuskan yang terbaik"). Maou boleh membatalkan salah satunya kapan saja. Agent boleh bertanya lagi hanya untuk butir di "Masih terbuka".

## 11. Keputusan

### Diputuskan (1 Nov 2026, permintaan Maou)

1. **Loadout: 3 karakter × 2 senjata.** Karakter: **Arka** (Pendebat, damage), **Mira** (Pengarsip, petunjuk), **Sena** (Penjaga, Heart). Tiap karakter punya 2 senjata dengan syarat bonus berbeda. Loadout **hanya** menyentuh damage (0,95–1,10), Heart awal (maks 5), dan petunjuk metadata; tidak pernah menyentuh rubrik, level kriteria, atau temuan. Detail §13.2.
2. **Lantai dinamis.** Jumlah dan isi lantai ditentukan dimensi kelemahan yang benar-benar ada, bukan nomor tetap. Antek selalu muncul sebelum boss. Detail §7 dan §13.3.
3. **Poin dan rank.** Poin dihitung server, idempoten, dan dinormalisasi terhadap poin maksimum run (karena jumlah lantai berubah). Rank memakai rasio, bukan ambang absolut. Detail §13.5.
4. **Debrief kalah/mati.** Catatan Penjaga per monster + Epitaf saat Heart habis; wajib menyebut kutipan naskah dan kriteria, tanpa menulis ulang naskah. Detail §9 dan §13.6.
5. **Gaya pertanyaan.** Bahasa Indonesia sederhana, ≤28 kata, satu tanda tanya, tipe serangan dirotasi, ada fallback templat. Detail §8.
6. **RAG.** Rencana retrieval yang mengikat ada di `docs/RAG-PLAN.md`. Chat/LLM lewat Kagiro; embedding default FTS, upgrade lokal 768 dimensi kalau evaluasi menuntut. Jangan berasumsi vektor jalan tanpa angka. Setiap pertanyaan, judge, dan debrief memakai potongan naskah yang benar-benar di-retrieve dan lolos validator kutipan.
7. **Markdown kanonik.** `.docx`, PDF berteks, `.md`, dan `.txt` dikonversi di browser ke Markdown polos. Markdown itu satu-satunya `source_text`; tidak ada teks kedua yang dipakai validator. Detail §9.
8. **Dua lapis AI.** Cartographer mengusulkan peta dungeon; `buildFloorPlan` menghitung/mengunci; Warden menulis entitas dan pertanyaan per monster. Damage/poin/Heart tetap kode. Detail §13.9.

### Diputuskan (30 Okt 2026)

1. **LLM runtime: provider-agnostic, pilih lewat uji, bukan lewat selera.**
   - Semua panggilan lewat `lib/llm.ts` (antarmuka `LLMProvider`); provider dan model dari env (`LLM_PROVIDER`, `LLM_MODEL`). Tidak ada nama model di dalam kode logika.
   - Syarat model: mendukung output JSON, cukup baik berbahasa Indonesia, dan bisa dipanggil lewat API key yang Maou punya. Mulai dengan model yang key-nya sudah ada di tangan Maou.
   - Kunci model hanya setelah lolos uji kecil di `scripts/prompt-tests/judge-eval.ts` (set 20 jawaban: bagus, sedang, kosong, ngawur, plus "5 responden, dipilih acak, menurut saya cukup"). Ambang ditetapkan **sebelum** melihat hasil: JSON valid >= 95%, quote lolos validator >= 90%, dan jawaban asal tidak pernah mendapat level 2 pada kriteria apa pun. Gagal: ganti model atau perbaiki prompt, catat versinya.
   - Temperature rendah (0 sampai 0,2) untuk Judge dan Questioner; sedikit lebih tinggi (sampai 0,4) untuk Report writer.
   - Catatan privasi: untuk hackathon hanya naskah milik Maou sendiri yang dikirim ke penyedia (butir 5). Peringatan privasi di layar unggah tetap wajib.

2. **Bahasa.** UI, pertanyaan boss, dan Debrief AI: **Indonesia**. Naskah boleh Indonesia atau Inggris; kutipan selalu dalam bahasa asli naskah. Pengujian dan demo difokuskan ke naskah berbahasa Indonesia. Rules engine sudah memuat kata kunci Indonesia dan Inggris; tambah tes untuk keduanya.

3. **Embedding: Kagiro tidak punya endpoint embedding. Default MVP = FTS; vektor lokal opsional.**
   - **Kagiro dipakai untuk chat/LLM**, bukan embedding. Sudah diuji: `GET /v1/models` hanya mengembalikan model chat/completion, dan `POST /v1/embeddings` mengembalikan 404 untuk semua kandidat.
   - **Jalur A — default R0–R2: FTS Postgres.** Tanpa key, tanpa model lokal. Query memakai teks klaim + nama `weakness_type`; boleh ditambah ekspansi sinonim lewat Kagiro kalau evaluasi menunjukkan recall rendah. Batas: buta parafrase dan kata berimbuhan karena config `simple`.
   - **Jalur B — vektor lokal (opsional, R1):** `Xenova/multilingual-e5-base`, 768 dimensi, jalan di Node server. Tanpa API key, unduh ~280 MB sekali, cache di disk. Wajib pakai prefix `query: ` dan `passage: `; potong input >512 token. `manuscript_chunks.embedding` sudah `vector(768)`, jadi **tidak perlu migration dimensi**. Cocok untuk demo lokal; cek dulu ukuran image/cold start kalau deploy serverless.
   - **Jalur C — Gemini/OpenAI:** hanya kalau ada key valid. **Free tier Gemini Embedding 2 boleh untuk demo**, dengan catatan input free tier dipakai Google untuk meningkatkan produk; hanya naskah sendiri/berizin. Jangan dijadikan prasyarat; jangan blok R0.
   - Uji sanity tetap sama: 10 pertanyaan, potongan benar masuk top-3 pada **≥8 dari 10**. Gagal: tetap FTS, catat angkanya, jangan pura-pura lulus.
   - Nama model tidak hardcode di luar `lib/embed.ts` dan env `EMBEDDING_MODEL`.

4. **Ghost: salah tandai tidak memotong Heart.** Pemain punya **2 tebakan**. Tebakan salah menampilkan status referensi itu (asli / `needs_review`) dan dicatat di `ghost_checks`; setelah tebakan kedua salah, jawabannya diungkap. Laporan mencatat "menuduh referensi asli: N kali". Alasan: cakupan Crossref/OpenAlex tidak lengkap (buku dan prosiding sering tidak terindeks), jadi menghukum tebakan itu tidak adil, dan PRD sudah menyatakan temuan `needs_review` tanpa biaya Heart.

5. **Naskah demo dan pilot.**
   - Demo: naskah **milik Maou sendiri** yang lengkap (dengan daftar pustaka).
   - Tes regresi dan kalibrasi pilot: naskah **sintetis fiktif** dengan kelemahan yang sengaja ditanam dan kunci jawabannya (`fixtures/manuscripts/`).
   - Naskah mahasiswa lain: hanya dengan izin tertulis, dan tidak sebelum hackathon.

6. **Debrief AI tidak berisi kalimat tulis ulang.** Tetap pertanyaan dan checklist. Tinjau ulang setelah ada data `pilot_feedback.advice_usefulness`.

### Dari keputusan sebelumnya (tetap berlaku)
- Bentuk serangan boleh diulang setelah semua bentuk terpakai, asalkan tidak berturut-turut dan pertanyaannya beda (bagian 8).
- Input naskah: .docx / PDF berteks / .md / .txt, konversi ke Markdown kanonik di browser (bagian 9).
- `MINION_HP = 100`; beda boss dan antek lewat `HIT_CAP` (bagian 7).
- Ambang confidence rendah 0,5.
- Naskah harus lengkap, termasuk daftar pustaka. Ghost selalu dimainkan (bagian 9).
- Jumlah referensi: gerbang keras hanya "minimal 1 entri terparse" atau angka pedoman yang diisi pemain; default per tahap hanya peringatan (bagian 9).

### Masih terbuka (tanya Maou)
- Model Kagiro final per boss (menunggu hasil uji butir 1).
- Pilihan embedding: FTS-only (default) vs Gemini free tier vs lokal `multilingual-e5-base` (menunggu evaluasi recall dan izin naskah).

### Catatan arsitektur yang harus diingat
- Di M2, route `/api/encounter/answer` menerima `hp`, `hearts`, `sourceText` dari client. Itu bisa dicurangi dan bertentangan dengan aturan bagian 6 (state permainan ditulis server). Dibiarkan di M2 dengan komentar `TODO(M3)`; **di M3 state encounter dihitung dan disimpan server**, client hanya mengirim jawaban.

## 12. Milestone dan Definition of Done

Tiap milestone: tes unit lolos (`vitest`), `tsc --noEmit` bersih, `next build` sukses, dan cek manual di browser.

**M1: Peta jalan**
- Next.js + Tailwind + Phaser terpasang; Phaser hanya di client.
- Aset Kenney di `public/assets/tiny-dungeon/`, ukuran tile dicatat dari file asli, `CREDITS.md` ada.
- `buildFloorPlan` + `generateFloor` dari **fixture tes** (bukan data runtime) + tes unit (jumlah monster = jumlah temuan, pemadatan 3 monster/ruang, antek sebelum boss, 1 temuan langsung boss, ruang boss terakhir dan lebih besar, tangga ada, deterministik per seed, dimensi kosong dilewati, jumlah lantai 2–6).
- Pemain bisa berjalan (keyboard), menabrak dinding, masuk ruang, memicu overlay encounter React. Pintu terkunci/terbuka berfungsi. Pertanyaan memakai route nyata; tidak ada pertanyaan dummy.

**M2: Loop pertarungan**
- `lib/balance.ts`, validator kutipan, rules engine, damage, dengan Judge **nyata** lewat Kagiro; fixture hanya untuk tes unit.
- HP boss/antek, Heart, `missing`, bar skor per kriteria, Objection!, Debrief AI (templat), turun lantai, kalah dan ulang lantai.
- Tes wajib "jawaban asal tidak one-shot" (bagian 8) dan tes tiap aturan deterministik.

**M2b: Rasa game (loadout, poin, debrief)**
- Katalog karakter + senjata (§13.2); layar pilih karakter/senjata; validasi server; `runs.character_slug`, `runs.weapon_slug`.
- Damage memakai `weaponBonus` yang dihitung server; tes: bonus tidak pernah >1,10, satu jawaban sempurna tidak membunuh boss, loadout tidak mengubah level kriteria.
- Poin per monster/lantai, streak, rank berbasis rasio (§13.5); tes idempotensi dan perhitungan `RUN_POINTS_MAX`.
- Catatan Penjaga nyata lewat Kagiro dengan validator kutipan; tidak ada fallback dummy; tes kutipan palsu ditolak. Epitaf run-level belum diimplementasikan.
- Tes variasi pertanyaan: tidak ada `question_hash` ganda per finding; tidak ada pembuka sama dalam satu lantai; fallback templat jalan.

**M3: Backend**
- Supabase terhubung, `supabase db reset` sukses dengan migration yang ada (laporkan hasilnya).
- Auth, unggah .docx / PDF berteks / .md / .txt, konversi ke **Markdown kanonik** di browser (heading, paragraf, daftar, tabel; tanpa HTML), peringatan privasi, **cek kelengkapan** dengan checklist bagian yang kurang (tes: naskah tanpa daftar pustaka ditolak; proposal tanpa hasil tetap lolos; `min_references = 20` dengan 12 entri ditolak; tanpa `min_references`, skripsi dengan 12 entri lolos dengan peringatan), ekstraksi Research Map, layar konfirmasi.
- Chunking + FTS + simpan ke `manuscript_chunks`. Embedding lokal opsional; kalau belum ada, retrieval tetap FTS.
- Migration baru: katalog `characters`/`weapons`, kolom loadout + poin di `runs`, tabel `run_points_events` dan `run_debriefs`. Semua state permainan ditulis server.

**M4: Recon nyata + RAG + dua lapis AI**
- Detektor kode + detektor LLM, validator, ranking menghasilkan findings asli. Recon async dengan layar progres; waktu tiap langkah tercatat dan dilaporkan.
- Retrieval nyata sesuai `docs/RAG-PLAN.md` (R0–R3): bukan potong 24 chunk teratas; hybrid + query per klaim; evaluasi retrieval dijalankan dan angkanya dilaporkan.
- **Lapis 1 Cartographer**: findings + Markdown ringkas → `DungeonDraft` JSON; `buildFloorPlan` memvalidasi/menghitung/mengunci. Tes: output AI yang melanggar cap/urutan dibuang, bukan dipakai.
- **Lapis 2 Warden**: persona + pertanyaan + debrief per monster dengan retrieval; validator kutipan; fallback templat. Tes: tidak ada pertanyaan tanpa `anchor_quote` valid.
- Questioner memakai konteks hasil retrieval + validator kutipan; pertanyaan tidak dikirim kalau tidak punya anchor bukti.

**M5: Ghost + sidang akhir + report + revise-run.**

**M6: Polish**: suara (default mati), minimap, D-pad mobile, pesan error, halaman about, `CREDITS.md` final, kalibrasi poin setelah playtest.

### Format laporan akhir milestone
```
## M<n> selesai / sebagian
Jalan (sudah dijalankan): ...
Belum / gagal (dengan error): ...
Cara mencoba: perintah + langkah di browser
Tes: hasil vitest, tsc, build
Angka terukur (kalau ada): ...
Keputusan yang dibutuhkan dari Maou: ...
```

## 13. Game feel: karakter, senjata, poin, debrief

Tujuan bagian ini: pemain harus merasa **turun ke dungeon**, bukan mengisi formulir. Semua aturan di bawah tetap tunduk pada prinsip §1: grounded, checkable, rubric-first, pemain tetap penulis.

### 13.1 Loop satu run

```
Camp / pilih karakter + senjata
  → pratinjau denah (lantai & antek terlihat, boss disamarkan)
  → Lantai 1..N: antek → boss
  → kalah? Catatan Penjaga → ulangi ruang / lanjut dengan Heart tersisa
  → Heart habis? Epitaf → ulangi lantai atau perbaiki naskah
  → Ghost (Nyxara) → Ruang Takhta (Eldravos)
  → layar Rank + poin + Weakness Report
```

Tidak ada timer di MVP. Tekanan datang dari pertanyaan dan Heart, bukan countdown.

### 13.2 Karakter dan senjata

Tiga karakter, masing-masing dua senjata. Semua terbuka di MVP; tidak ada shop dan tidak ada pay-to-win.

| Slug | Karakter | Peran | Pasif | Heart awal |
|---|---|---|---|---|
| `arka` | **Arka — Sang Pendebat** | penyerang jarak dekat | **First Blood**: jawaban pertama di tiap ruang mendapat +0,02 damage | 3 |
| `mira` | **Mira — Sang Pengarsip** | penembak / pendukung informasi | **Indeks**: sekali per lantai, tampilkan label bagian dari `evidence_quote` (metadata, bukan jawaban) | 3 |
| `sena` | **Sena — Sang Penjaga** | penahan | **Tabah**: +1 Heart saat run dimulai (maks 5) | 4 |

| Senjata | Karakter | Base | Syarat bonus | Maks |
|---|---|---|---|---|
| **Pedang Sitasi** | Arka | 1,00 | +0,10 jika jawaban menyebut penulis/tahun yang ada di `citations.raw_text` atau mengutip ≥6 kata dari naskah | 1,10 |
| **Belati Presisi** | Arka | 1,02 | +0,05 jika jawaban mengutip ≥6 kata persis dari naskah | 1,07 |
| **Busur Angka** | Mira | 1,00 | +0,10 jika jawaban memuat angka yang ada di naskah (n, p, r, R², persen) | 1,10 |
| **Jaring Bukti** | Mira | 1,03 | +0,04 jika jawaban menyebut label bagian ("metode", "hasil", "kesimpulan", "daftar pustaka") | 1,07 |
| **Perisai Batas** | Sena | 0,97 | tidak ada bonus damage; efek: sekali per lantai, satu kehilangan Heart dibatalkan | 0,97 |
| **Lentera Kubur** | Sena | 1,04 | +0,04 jika jawaban memuat kata batas/keterbatasan ("hanya", "tidak berlaku", "batas", "keterbatasan") | 1,08 |

Aturan implementasi:

- `weaponBonus = clamp(base + conditionBonus + passiveBonus, 0,95, 1,10)`. Dihitung **server** dari jawaban + `source_text`; client tidak mengirim bonus.
- Syarat senjata hanya memeriksa **permukaan jawaban** (kutipan/angka/label), tidak menilai kebenaran. Karena itu bonus tidak boleh menaikkan level kriteria.
- `Perisai Batas` adalah satu-satunya efek non-damage; disimpan sebagai `weapon_effect_used` per lantai di server, bukan di browser.
- Petunjuk Mira hanya boleh menyebut **lokasi** bukti (label bagian), tidak boleh menampilkan kalimat jawaban atau kriteria yang benar.
- Loadout dipilih setelah Recon, sebelum pintu pertama. Tidak boleh ganti di tengah run. Setelah mati atau revisi naskah, run baru boleh memakai loadout berbeda.
- Klien hanya mengirim `character_slug` dan `weapon_slug`; server mencocokkan katalog dan menolak slug yang tidak ada atau senjata milik karakter lain.

### 13.3 Denah dan komposisi lantai

Aturan lengkap ada di §7. Yang harus terlihat di layar:

- Pratinjau denah menampilkan **jumlah lantai**, nama dimensi, dan siluet antek. Boss hanya tampil sebagai bayangan ("???").
- Di dalam lantai: antek berada di ruang lebih kecil, boss di ruang terbesar dengan obor merah. Pintu boss tetap terkunci sampai antek yang wajib selesai.
- Jumlah monster di pratinjau = jumlah temuan, bukan jumlah ruang. Ruang dengan 3 monster menampilkan tiga siluet. Kalau dimensi hanya punya 1 temuan, monster itu tampil sebagai boss (tidak ada antek).
- Lantai kosong tidak dibuat. Kalau tidak ada temuan penelitian sama sekali, pemain tetap melewati Ghost + Ruang Takhta ("Koridor Sunyi").
- `buildFloorPlan` mengembalikan urutan room yang deterministik; `generateFloor` hanya menggambar. Jangan menaruh logika kualitas naskah di Phaser.

Bentuk data yang disarankan:

```ts
type RoomPlan = {
  kind: "minions" | "boss" | "special";
  monsterIds: string[]; // 1–3; boss tepat 1
};

type FloorPlan = {
  floorOrder: number;
  dimension: "gap" | "align" | "method" | "audit" | "ghost" | "throne";
  bossSlug: string;
  rooms: RoomPlan[];
};
```

### 13.4 Pertarungan tanya-jawab

- Satu layar encounter berisi: nama penguji, kutipan naskah yang diserang, pertanyaan, tiga pengingat **Klaim / Bukti / Batas**, textarea, tombol **Serang** dan **Objection!**.
- Jawaban minimal 12 karakter dan maksimal 1.200 karakter. Tidak ada jawaban pilihan ganda.
- Setelah menjawab: tampilkan damage, HP, perubahan Heart, level per kriteria, dan **satu** kalimat `missing`. Jangan langsung membuka debrief panjang; debrief hanya saat kalah.
- Jika jawaban kosong atau terlalu pendek, server mengembalikan 0 damage dan tidak memotong Heart; UI memberi tahu "tulis dulu".
- Combo/streak ditampilkan kecil di HUD (ikon api, bukan teks besar). Streak putus saat skor rasio < 0,5 atau Heart hilang.
- Objection! selalu tersedia, tidak memotong Heart, dan langsung membuka pintu. Ini katup keselamatan untuk temuan yang salah.
- Tidak ada pertanyaan yang menyuruh pemain menebak jawaban benar. Semua pertanyaan harus bisa dijawab dari naskah atau alasan eksplisit pemain.

### 13.5 Poin dan rank

Semua poin dihitung **server** dan disimpan sebagai event; angka di klien hanya tampilan.

| Event | Poin | Syarat |
|---|---:|---|
| Monster antek menang | 20 | `won`, bukan `conceded`/`disputed` |
| Monster boss menang | 40 | `won` |
| Lantai selesai | 100 | boss `won`, semua monster di lantai selesai |
| Lantai tanpa Heart hilang | 30 | Heart awal lantai = Heart akhir lantai |
| Lantai flawless | 50 | semua evaluasi di lantai punya rasio skor ≥0,75 dan tidak ada Heart hilang |
| Streak | 10 per jawaban | 3 jawaban berturut-turut dengan rasio ≥0,75; jawaban ke-4 dan seterusnya dapat 10; maks 20 per lantai |

- `RUN_POINTS_MAX` dihitung dari `FloorPlan`, bukan konstanta tetap: `Σ poin monster + Σ poin lantai + Σ streak maks per lantai`. Rank memakai `RANK_RATIO` (§7): S ≥85%, A ≥70%, B ≥50%, sisanya C.
- Event poin memakai kunci unik `(run_id, kind, encounter_id, seq)` supaya klik ganda atau refresh tidak menggandakan poin.
- Poin tidak pernah menambah damage, Heart, atau mengubah rubrik. Hadiah MVP: badge rank, judul run, dan entri codex; tidak ada toko.
- Run baru (setelah mati/revisi) punya poin baru; poin run lama tidak digabung.

### 13.6 Catatan Penjaga dan Epitaf

**Catatan Penjaga** muncul saat encounter `lost` atau `conceded`:

1. **Yang tadi kurang** — kalimat pendek + `criterion_id` + potongan jawaban pemain.
2. **Bukti yang belum dipakai** — satu kutipan persis dari naskah + label bagian.
3. **Pertanyaan balik** — satu pertanyaan yang harus dijawab penulis.
4. **Saran taktis** — karakter/senjata yang cocok dengan kelemahan; wajib menyebut "ini hanya mengubah damage, bukan penilaian".
5. Disclaimer.

**Epitaf** muncul saat Heart habis:

- lantai yang menghentikan run;
- pola jawaban (mis. "jawabanmu kuat di klaim, lemah di bukti angka");
- satu bukti naskah yang paling sering terlewat;
- dua pilihan: ulangi lantai dengan loadout yang sama, atau mulai run baru dengan loadout berbeda;
- tidak ada vonis "naskahmu buruk".

Aturan grounding sama dengan §9: setiap kalimat faktual punya `finding_id`/`criterion_id`/`quote`; validator menolak kutipan yang tidak ada. LLM gagal → templat deterministik. Biaya dijaga: maksimal 1 debrief per monster (cache) dan 1 Epitaf per run.

### 13.7 Keadilan dan anti-curang

- Semua state permainan (HP, Heart, poin, loadout, debrief) ditulis server dengan service role. Client hanya mengirim jawaban dan slug loadout.
- `weaponBonus` dihitung server; client tidak bisa mengirim bonus, damage, atau poin.
- Petunjuk tidak pernah membocorkan jawaban; hanya label bagian, kriteria yang masih 0, atau saran loadout.
- Tidak ada hukuman untuk Objection!, tidak ada Heart loss karena jawaban terlalu pendek, dan tidak ada pertanyaan jebakan yang jawabannya tidak ada di naskah.
- Warna bukan satu-satunya penanda (Heart, HP, rank memakai bentuk/teks juga). Font minimum 14px untuk teks pertanyaan.

### 13.8 Checklist UI MVP

- [ ] Layar loadout: 3 kartu karakter, 2 senjata per karakter, penjelasan efek, tombol "Turun".
- [ ] HUD: Heart, lantai, poin, streak, ikon karakter/senjata.
- [ ] Ruang: monster, kutipan, pertanyaan, 3 pengingat, textarea, Serang, Objection!, petunjuk.
- [ ] Modal Catatan Penjaga + Epitaf.
- [ ] Layar rank: poin / maksimum, badge, ringkasan per dimensi, "belum diuji".
- [ ] Semua teks Indonesia, tanpa emoji, tanpa jargon yang tidak dijelaskan.

### 13.9 Dua lapis AI: Cartographer dan Warden

Ya, AI yang membaca naskah dan mengusulkan isi dungeon. Tetapi **AI tidak boleh menjadi satu-satunya penentu angka**. Pembagiannya:

```
Naskah Markdown kanonik
  → Recon (detektor kode + LLM + RAG)        : mengumpulkan temuan + kutipan
  → Lapis 1: Cartographer (AI)              : mengusulkan peta dungeon
  → buildFloorPlan (kode)                    : memvalidasi, menghitung, mengunci
  → Lapis 2: Warden (AI, per monster)         : menulis entitas + pertanyaan
  → Judge (LLM + rules) + damage (kode)      : menilai jawaban
```

#### Lapis 1 — Cartographer

**Tugas:** membaca ringkasan naskah + findings, lalu mengusulkan:

- tema dan nama tiap lantai;
- pengelompokan findings ke lantai/ruang;
- calon antek dan boss tiap lantai;
- satu kalimat lore per lantai;
- urutan lantai yang menurutnya paling masuk akal.

**Input:** Markdown kanonik (ringkas), Research Map confirmed, findings + `evidence_quote`, katalog boss/minion. **Bukan** seluruh naskah mentah.

**Output JSON wajib:**

```json
{
  "dungeon_title": "…",
  "floors": [{
    "dimension": "method",
    "theme": "…",
    "boss_slug": "kryvax",
    "minion_slugs": ["othrak", "xyrath"],
    "finding_ids": ["…"],
    "lore_line": "…"
  }],
}
```

**Yang diusulkan AI:** tema, lore, pasangan monster, pengelompokan.
**Yang dihitung kode:** jumlah lantai, urutan severity, jumlah monster (= jumlah finding), pemadatan maks 3 monster/ruang, boss = rank 1. Kalau output AI melanggar, kode membuang usulan itu dan memakai `buildFloorPlan` deterministik. AI tidak boleh menambah atau mengurangi finding.

#### Lapis 2 — Warden

**Tugas:** untuk tiap ruang, menulis entitas dan percakapan:

- satu kalimat persona boss/antek (bukan pidato panjang);
- pertanyaan berikutnya (lewat Questioner + RAG);
- reaksi singkat saat kena damage;
- Catatan Penjaga saat kalah;
- Epitaf saat Heart habis.

**Input:** `RoomPlan` + finding + `evidence_quote` + 3–4 chunk hasil retrieval + pertanyaan sebelumnya. **Tidak** membaca ulang seluruh naskah.

**Output:** JSON tervalidasi (pertanyaan + `anchor_quote` + `target_criteria`; debrief + kutipan). Semua kutipan dicek substring.

#### Kenapa dua lapis, bukan satu prompt raksasa

- Satu prompt untuk seluruh naskah + seluruh monster + seluruh pertanyaan akan kepanjangan, mahal, dan tidak konsisten.
- Cartographer cukup dipanggil **sekali per run** setelah Recon; Warden dipanggil **per monster** dan bisa di-cache.
- Kalau Warden gagal, dungeon tetap bisa dimainkan dengan templat; kalau Cartographer gagal, `buildFloorPlan` tetap menghasilkan dungeon dari findings.

#### Aturan keras

- AI **tidak** menentukan damage, Heart, poin, rank, atau level kriteria.
- AI **tidak** boleh menciptakan finding, sitasi, angka, atau kutipan.
- AI **tidak** boleh menambah, mengurangi, atau menduplikasi finding. Semua finding wajib kebagian monster.
- Semua output AI divalidasi zod + validator kutipan; gagal → fallback deterministik.
- Simpan `cartographer_model`, `cartographer_prompt_version`, `warden_model`, `warden_prompt_version` di run/encounter.
