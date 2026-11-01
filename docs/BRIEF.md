# Brief agent: Sir, Actually | Research Boss Battle

Brief ini untuk agent coding yang membangun proyek ini. Baca seluruhnya sebelum mulai M1.

- Sumber: build prompt Maou + PRD (`docs/PRD.md`). Kalau keduanya bertentangan, **build prompt menang**; daftar konflik yang sudah diputuskan ada di bagian 3.
- Skema database **sudah ditulis**: `supabase/migrations/`. Jangan menulis ulang dari nol; ubah lewat migration baru.
- Kerjakan per milestone. Setelah tiap milestone: jalankan, tes, **berhenti**, lapor pakai format di bagian 12. Jangan mulai milestone berikutnya sebelum Maou bilang lanjut.

---

## 1. Produknya

Web game hackathon (Beginner Track, Theme 1: AI-Powered Mini Games). Mahasiswa mengunggah naskah risetnya sendiri; naskah itu jadi **dungeon 2D yang bisa dijelajahi**. Tiap ruang berisi penguji (boss/antek) yang menyerang satu kelemahan naskah lewat pertanyaan. Pemain bertahan dengan jawaban. Hasil akhir: **peta kelemahan**, bukan vonis "layak/tidak layak".

Bukan AI detector, bukan penulis ulang naskah, bukan pengganti dosen pembimbing.

Prinsip yang tidak boleh dilanggar:
- **Grounded**: pertanyaan dan penilaian hanya dari Research Map yang sudah dikonfirmasi pemain.
- **Checkable**: setiap kritik menunjuk kutipan persis dari naskah.
- **Rubric-first**: skor dari rubrik tetap; damage dihitung kode, bukan LLM.
- **Pemain tetap penulis**: game tidak pernah menulis kalimat jadi untuk naskah.

## 2. Alur 6 tahap

1. **Context Window**: unggah naskah (.docx / PDF berteks), **cek kelengkapan** (bagian 9; naskah tidak lengkap, termasuk tanpa daftar pustaka, tidak bisa lanjut), ekstrak Research Map (masalah, gap, tujuan, RQ, metode, temuan, kesimpulan, keterbatasan, daftar pustaka). Pemain mengedit dan mengonfirmasi. Setelah confirmed, peta beku.
2. **Recon**: detektor kode + LLM (dengan RAG) menghasilkan findings. Job async bertahap dengan layar progres.
3. **Dungeon**: maks 4 lantai (The Four Dungeon Lords: Veylith / Gap Hunter, Draeven / Aligner, Kryvax / Methodologist, Morvane / Auditor). Lantai tanpa temuan dilewati. Ruang sebelum boss dijaga oleh Dungeon Creatures (minions: Varkul, Nethrix, Zorveth, Thalgrim, Xyrath, Othrak, Velmora, Grivak).
4. **Ghost**: perpustakaan terkutuk yang dijaga Nyxara (The Forgotten Keeper / Ghost Library). Pemain menandai 1 referensi palsu yang disisipkan di antara referensi asli.
5. **Sidang akhir**: ruang takhta Eldravos, The Ancient Sovereign (Final Boss / Sir, Actually). Temuan rank tertinggi se-naskah, gaya penguji Strict / Detail-Oriented / Friendly.
6. **Weakness Report**: profil per dimensi (Perlu dibenahi / Cukup / Kuat) + weak links dengan kutipan. Lantai kosong ditulis "tidak ditemukan oleh detektor", bukan "aman".

## 3. Konflik PRD vs build prompt (sudah diputuskan)

| Hal | PRD | Dipakai | Alasan |
|---|---|---|---|
| Skala rubrik | 0-3, skor = rata-rata | **0/1/2 per kriteria, skor = jumlah** (0-6 untuk 3 kriteria) | Build prompt bagian 5 ("PERUBAHAN PENTING") |
| Heart hilang | rata-rata < 1 | **skor ≤ 1** (dari 6) | Build prompt |
| Pertanyaan per boss | sekitar 2 | **boss min. 3 jawaban bagus, antek min. 2; maks 4 pertanyaan per ruang** | Build prompt; cegah one-shot |
| Status encounter | active / won / retried | pending / active / won / conceded / disputed / lost / retried | Kebutuhan alur baru; sudah di migration |
| Research Map | tanpa kesimpulan | `claims.kind` termasuk `conclusion` | Build prompt menyebut kesimpulan |

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
- React untuk semua UI di atas kanvas (HUD, dialog, textarea, Kitab Nasihat, laporan).
- Phaser dan React berkomunikasi lewat **event bus** (`mitt`), bukan state global bersama.
- Provider LLM dan embedding **belum diputuskan**: bungkus di `lib/llm.ts` dan `lib/embed.ts` dengan antarmuka sendiri. Untuk M1-M2 pakai implementasi dummy (`provider: 'dummy'`).
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
| `20261030000100_init_schema.sql` | 18 tabel PRD, indeks, trigger profil otomatis, trigger pembeku Research Map confirmed |
| `20261030000200_rls.sql` | RLS semua tabel, helper kepemilikan di schema `private`, column grants `citations` |
| `20261030000300_seed_catalog.sql` | 14 `weakness_types`, 6 `rubrics` (skala 0/1/2), 6 `bosses` |
| `20261030000400_recon_support.sql` | **Tambahan di luar 18 tabel**: `recon_jobs` (progres + timing Recon), RPC `match_manuscript_chunks` (vektor) dan `search_manuscript_chunks_fts` (fallback) |

Menjalankan: `supabase start` + `supabase db reset` (butuh Docker), atau `supabase link` lalu `supabase db push` ke project remote.

Aturan yang harus dipatuhi kode:

1. **Client hanya menulis bahan naskah draft**: `manuscripts`, `research_maps` (status draft, plus konfirmasi draft ke confirmed), `claims`, `citations`, `claim_citations`, dan `pilot_feedback`. **Semua state permainan** (findings, runs, encounters, turns, evaluations, ghost_checks, reports, manuscript_chunks, recon_jobs) ditulis **server dengan service role**. RLS sudah memblok client, jadi HP/Heart tidak bisa dicurangi dari browser.
2. **`citations` dari client wajib select kolom eksplisit**: `select('id, research_map_id, raw_text, parsed, created_at')`. `select('*')` akan error **permission denied**. Kolom `is_injected`, `verification_status`, `matched_work` sengaja disembunyikan karena membocorkan jawaban Ghost (referensi sisipan pasti `not_found`). Server mengirim status verifikasi setelah tahap Ghost selesai.
3. **Research Map confirmed beku** (trigger). Revisi naskah = `research_maps` versi baru (`version + 1`), bukan update. Di peta confirmed, yang boleh: update `citations.verification_status / matched_work / verified_at`, dan insert satu citation `is_injected = true` (Ghost).
4. **`research_maps` dari client**: insert hanya kolom `manuscript_id, version, source_text`; update hanya `status, confirmed_at` (konfirmasi). Kolom `completeness` **hanya ditulis server** (kalau client bisa mengisinya, cek kelengkapan bisa dilewati). Trigger menolak konfirmasi kalau tidak ada daftar pustaka (citation non-sisipan), `completeness` masih null, atau `completeness.missing` tidak kosong.
5. Satu run `active` per Research Map (unique index). Revisi: set run lama `closed_revised`, buat run baru dengan `previous_run_id`.
6. **Embedding**: kolom `manuscript_chunks.embedding` sengaja tanpa dimensi karena model belum dipilih. Setelah dipilih: migration baru untuk mengunci dimensi (`vector(N)`) dan menambah indeks HNSW (opsional; naskah hanya puluhan sampai ratusan potongan). Selalu isi `embedding_model`; RPC menyaring per model.
7. Operator pgvector ada di schema `extensions`. Di SQL dengan `search_path = ''`, tulis `operator(extensions.<=>)`.
8. Fallback FTS memakai config `'simple'` karena bahasa belum diputuskan.
9. Fungsi trigger yang membaca kolom tersembunyi (`citations.is_injected`) harus `security definer`, karena trigger jalan sebagai role pemanggil (`authenticated`). Bug ini sempat ada dan tertangkap tes.
10. Hapus naskah: soft delete (`deleted_at`) menyembunyikan semua turunan; hard delete men-cascade semuanya.

Status verifikasi migration: dijalankan di PGlite 0.3.4 (Postgres WASM + pgvector) dengan stub `auth.users`, `auth.uid()`, dan role Supabase. Lolos: 19 tabel tercipta, seed lengkap, isolasi antar-user, column grants, blok tulis state permainan dari client, unique index, check constraint, soft/hard delete cascade, RPC vektor dan FTS. Trigger pembeku terbukti terpicu, tapi **teks pesan error-nya tidak bisa dicek** karena PGlite crash di setiap `raise exception` (bug PGlite, bukan migration). **Belum dites di Supabase sungguhan**: jalankan `supabase db reset` sekali di M3 dan laporkan hasilnya.

## 7. Aturan game dan balance

### Roster Monster & Hierarki Penamaan (Universe Dark Fantasy Original)

Sir, Actually mengusung semesta dark fantasy original dengan fonetik konsisten: dark, ancient, alien, dan berkarakter kuat.

#### Naming Hierarchy
```
# ELDRAVOS (THE ANCIENT SOVEREIGN) — Final Boss
│
├── The Four Dungeon Lords
│   ├── Floor 1: Veylith — The Void Stalker (Gap Hunter)
│   ├── Floor 2: Draeven — The Dreadfang (The Aligner)
│   ├── Floor 3: Kryvax — The Twisted Brood (Methodologist)
│   └── Floor 4: Morvane — The Gravebound (The Auditor)
│
├── The Forgotten Keeper
│   └── Floor 5: Nyxara — The Forgotten Keeper (Ghost Library)
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
   - **Peran / Dimensi**: Gap Hunter (Lantai 1)
   - **Deskripsi**: Predator dari kegelapan yang memburu sesuatu yang hilang. Menyerang klaim celah riset yang tidak memiliki fondasi literatur pendukung.
2. **02. Draeven**
   - **Gelar**: The Dreadfang
   - **Peran / Dimensi**: Aligner (Lantai 2)
   - **Deskripsi**: Binatang buas yang memiliki dua kepala dengan kehendak berbeda. Mengoyak inkonsistensi antara rumusan masalah, tujuan penelitian, dan pertanyaan penelitian (RQ).
3. **03. Kryvax**
   - **Gelar**: The Twisted Brood
   - **Peran / Dimensi**: Methodologist (Lantai 3)
   - **Deskripsi**: Makhluk hasil mutasi yang terus berevolusi melalui eksperimen gagal. Menguji validitas metodologi, kecukupan ukuran sampel, dan batasan generalisasi.
4. **04. Morvane**
   - **Gelar**: The Gravebound
   - **Peran / Dimensi**: Auditor (Lantai 4)
   - **Deskripsi**: Roh ksatria kuno yang menghakimi siapa pun yang memasuki wilayahnya. Menghukum kesimpulan yang berani melompat melampaui data temuan empiris.
5. **05. Nyxara**
   - **Gelar**: The Forgotten Keeper
   - **Peran / Dimensi**: Ghost Library (Lantai 5)
   - **Deskripsi**: Penjaga perpustakaan terkutuk yang menyimpan ingatan dan kitab palsu. Menyisipkan sitasi fiktif yang harus diidentifikasi oleh pemain.
6. **06. Eldravos**
   - **Gelar**: The Ancient Sovereign
   - **Peran / Dimensi**: Final Boss (Lantai 6 / Ruang Takhta)
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

### Taksonomi (seed di `weakness_types` & `bosses`)
Lantai:
- **Lantai 1 — Veylith** (Gap Hunter): `gap_unsupported`, `gap_answered_by_own_refs`, `claim_without_citation`.
- **Lantai 2 — Draeven** (The Aligner): `problem_objective_gap`, `objective_rq_mismatch`.
- **Lantai 3 — Kryvax** (Methodologist): `rq_method_mismatch`, `sample_unreported`, `generalization_beyond_sample`, `limitation_missing`.
- **Lantai 4 — Morvane** (The Auditor): `conclusion_overclaim`, `objective_without_finding`, `abstract_result_mismatch`.
- **Lantai 5 — Nyxara** (Ghost Library / The Forgotten Keeper): `citation_not_found`, `citation_claim_mismatch` (status `needs_review`, tanpa biaya Heart, hanya saran di laporan).
- **Lantai 6 — Eldravos** (Final Boss / The Ancient Sovereign): Pengujian puncak seluruh mata rantai riset.
Bentuk serangan yang boleh per tipe ada di `weakness_types.attack_types`.

### Urutan dan pemetaan
- Rank = urut severity desc, centrality desc, confidence desc. Tanpa skor desimal.
- Ruang di satu lantai = temuan dimensi itu, **diurut dari rank terendah ke tertinggi**; ruang terakhir = boss (temuan rank tertinggi lantai itu).
- Boss akhir = temuan rank tertinggi se-naskah. Kalau Recon kosong: sidang akhir memakai klaim sentral Research Map, tidak mengarang temuan.
- Batas ruang per run: 8 (usulan). Sisanya ke laporan sebagai "belum diuji".
- Confidence rendah = ruang opsional, bukan tuduhan.
- Batas kode: kelemahan pada klaim yang bukan RQ, temuan utama, atau kesimpulan dibatasi severity maks 2.

### Konstanta di `lib/balance.ts` (sudah disetujui Maou, ditala setelah playtest)

```ts
export const HEARTS_START = 3;
export const BOSS_HP = 100;
export const MINION_HP = 100;
export const HIT_CAP = { boss: 0.45, minion: 0.6 } as const; // fraksi HP maks per jawaban
export const HEART_LOSS_MAX_SCORE = 1;    // skor <= 1 kehilangan 1 Heart
export const MAX_QUESTIONS_PER_ROOM = 4;
export const MAX_ROOMS_PER_RUN = 8;
export const MAX_FLOORS = 4;
export const LOW_CONFIDENCE = 0.5;        // di bawah ini ruang jadi opsional
// Tebakan titik awal, BUKAN dari data; hanya peringatan kalau pemain tidak mengisi min_references.
export const DEFAULT_MIN_REFERENCES = { proposal: 10, skripsi: 20, jurnal: 15 } as const;
```

Rumus (kode, bukan LLM):

```
damage = floor(scoreTotal / scoreMax * HIT_CAP[kind] * hpMax)
```

Cek: boss maks 45 per jawaban, jadi butuh minimal 3 jawaban; antek maks 60, jadi butuh minimal 2. Karena damage sebanding dengan `hpMax`, angka HP hanya tampilan; yang menentukan jumlah jawaban adalah `HIT_CAP`. Jadi beda boss dan antek ada di `HIT_CAP`, bukan di HP. Setelah 4 pertanyaan dan HP > 0: encounter `conceded`, temuan `conceded`, skor tercatat. HP 0: `won`, temuan `defended`.

### Objection!
Pemain menandai temuan salah. Encounter dan temuan jadi `disputed`, catatan pemain ke `findings.dispute_note`, **tidak** memotong Heart, ruang dianggap selesai (pintu terbuka). Dicatat untuk kalibrasi.

### Heart habis
Encounter `lost`, tampilkan Kitab Nasihat (bagian 9), lalu pemain memilih: **ulangi lantai** (encounter lama `retried`, buat ulang dengan bentuk serangan yang belum dipakai) atau **perbaiki naskah** (alur revisi, bagian 9).

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
- Kalau semua bentuk sudah terpakai (tipe dengan 2-3 bentuk, sementara ruang bisa sampai 4 pertanyaan): bentuk **boleh diulang**, asalkan tidak sama dengan bentuk pertanyaan sebelumnya (tidak berturut-turut) dan `question_hash` belum pernah dipakai di temuan ini. Hash bentrok: minta Questioner membuat ulang sekali.

## 9. Bagian lain yang wajib dipatuhi

**Unggah naskah**. Format: **.docx** (`mammoth`) dan **PDF berteks** (`pdfjs-dist` atau `unpdf`). PDF hasil scan tidak didukung; kalau teks hasil ekstraksi kosong atau terlalu sedikit, tolak dengan pesan jelas. Ekstraksi teks **di browser**, jadi file aslinya tidak pernah diunggah atau disimpan; yang dikirim ke server hanya teksnya (`research_maps.source_text`). Ini juga menghindari batas body request dan tidak butuh bucket Storage. Tempel teks cukup jadi cadangan kalau ekstraksi gagal. Heading dari PDF sering tidak terbaca, jadi layar konfirmasi wajib bisa memperbaiki label bagian.

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

**Kitab Nasihat** (saat Heart habis). Per temuan: kutipan naskah bermasalah, kenapa lemah (merujuk kriteria yang gagal), daftar pertanyaan/checklist yang perlu diputuskan penulis. Wajib merujuk `finding_id` dan kutipan (validator cek kutipan ada di `source_text`). Dilarang menyebut sitasi atau angka yang tidak ada di naskah. **Bukan kalimat tulis ulang** (sementara). Tipe berdetektor kode memakai templat tetap; LLM hanya untuk tipe berdetektor LLM. Disclaimer "bukan pengganti dosen pembimbing" selalu tampil. Simpan di `encounters.advice` + `advice_prompt_version`.

**Recon**. Langkah: chunk (per heading, sekitar 200-400 kata) → embed → detektor kode → verifikasi referensi (Crossref per DOI, OpenAlex) → detektor LLM per klaim dengan retrieval (top-k + potongan dari bagian yang sama) → validator (`evidence_quote` harus substring persis dari chunk yang diambil; kalau tidak, buang dan hitung di `recon_jobs.discarded`) → severity/centrality → ranking → planner. Tiap eksekusi mengerjakan satu langkah (atau satu batch) lalu menyimpan `cursor`; batas Edge Function gratis 150 dtk wall-clock / 2 dtk CPU. Catat durasi per langkah di `recon_jobs.timings`; waktu Recon belum pernah diukur, jadi laporkan angkanya.

**Ghost**. Ghost generator (LLM) menulis 1 referensi palsu yang masuk akal (pola: nama jurnal asli, judul artikel yang tidak ada). Verifier harus **gagal** menemukannya di Crossref dan OpenAlex; kalau ketemu, buang dan buat ulang. Sisipkan sebagai `citations.is_injected = true`. Pemain berinteraksi dengan buku di perpustakaan untuk menandai. Simpan ke `ghost_checks` (`hit`, `duration_ms`). Referensi asli yang `not_found` = `needs_review`, tanpa biaya Heart.

**Revisi naskah di tengah run**. Run lama `closed_revised` → Research Map versi baru → run baru (Heart reset) → Recon penuh. Perbandingan deterministik di `reports.comparison`:
- tipe sama dan `evidence_quote` lama masih ada di `source_text` baru: **"masih ada"**
- kutipan lama hilang: **"berubah, belum tentu beres"** (tidak pernah "sudah beres")
- temuan tanpa padanan di run lama: **"baru"**

**Privasi**. Sebelum unggah, tampilkan peringatan bahwa teks naskah dikirim ke penyedia LLM/embedding eksternal, beserta kebijakan retensi penyedia (diisi setelah provider dipilih). Sediakan tombol hapus naskah.

## 10. Peta dungeon (inti permintaan)

Harus denah sungguhan, bukan layar form.

- `generateFloor(findings, floorOrder, seed): FloorMap` adalah **fungsi murni**, deterministik untuk seed yang sama, dengan tes unit.
- Output: `tiles: number[][]` (kode tile dari enum: WALL, FLOOR, DOOR_LOCKED, DOOR_OPEN, STAIRS, TORCH, TORCH_RED, DECOR), plus daftar `rooms` (`{ id, findingId, rect, isBoss, monsterSpawn }`), `playerSpawn`, `stairs`. Bentuk datanya dibuat mirip layer Tiled supaya nanti bisa diganti peta Tiled.
- Layout: lorong horizontal dengan N ruang berurutan (N = jumlah temuan lantai itu), ruang terakhir = ruang boss lebih besar, tangga di ujung ruang boss.
- Pintu antar ruang terkunci sampai temuan di ruang sebelumnya selesai (defended / conceded / disputed).
- Lantai tanpa temuan tidak digenerate. Maks 4 lantai.
- Render lewat Phaser Tilemap dari array (tanpa editor Tiled di MVP).
- Pemain: gerak per-tile dengan tween halus, tabrakan dinding. Panah/WASD di desktop, D-pad di layar untuk HP.
- Monster tampil di ruangnya. Berjalan ke monster/pintu memicu **encounter**: event bus mengirim `encounter:start`, React menampilkan overlay (dialog boss, kutipan naskah, textarea). Peta tetap terlihat di belakang; boss bergetar saat kena damage (`boss:hit`). Input gerak Phaser dimatikan selama overlay terbuka.
- Kamera mengikuti pemain. Ruang boss lebih gelap dengan obor merah.
- Minimap di pojok: ruang selesai, ruang saat ini, ruang boss tersembunyi sampai dibuka.
- Ghost = perpustakaan terkutuk Nyxara (`LibraryScene`), sidang akhir = ruang takhta Eldravos (`ThroneScene`).

**Aset**: Kenney "Tiny Dungeon" (CC0) dari https://kenney-assets.itch.io/tiny-dungeon ke `public/assets/tiny-dungeon/`. **Cek ukuran tile dari file yang diunduh, jangan menebak.** Sprite tambahan hanya CC0 (Kenney lain, OpenGameArt filter CC0). Tiap aset dicatat di `public/assets/CREDITS.md` (nama, URL, lisensi). Mapping sprite: Veylith (Gap Hunter), Draeven (Aligner), Kryvax (Methodologist), Morvane (Auditor), Nyxara (The Ghost), Eldravos (The Ancient Sovereign / Sir Actually - paling besar/menonjol); kunci sprite sudah ada di `bosses.sprite_key`. Suara default mati, ada tombol nyala.

# Patch untuk docs/BRIEF.md: ganti seluruh bagian 11

Tempel menggantikan "## 11. Keputusan terbuka" sampai sebelum "## 12". Keputusan di bawah diambil 30 Okt 2026 atas permintaan Maou ("putuskan yang terbaik"). Maou boleh membatalkan salah satunya kapan saja. Agent boleh bertanya lagi hanya untuk butir di "Masih terbuka".

## 11. Keputusan

### Diputuskan (30 Okt 2026)

1. **LLM runtime: provider-agnostic, pilih lewat uji, bukan lewat selera.**
   - Semua panggilan lewat `lib/llm.ts` (antarmuka `LLMProvider`); provider dan model dari env (`LLM_PROVIDER`, `LLM_MODEL`). Tidak ada nama model di dalam kode logika.
   - Syarat model: mendukung output JSON, cukup baik berbahasa Indonesia, dan bisa dipanggil lewat API key yang Maou punya. Mulai dengan model yang key-nya sudah ada di tangan Maou.
   - Kunci model hanya setelah lolos uji kecil di `scripts/prompt-tests/judge-eval.ts` (set 20 jawaban: bagus, sedang, kosong, ngawur, plus "5 responden, dipilih acak, menurut saya cukup"). Ambang ditetapkan **sebelum** melihat hasil: JSON valid >= 95%, quote lolos validator >= 90%, dan jawaban asal tidak pernah mendapat level 2 pada kriteria apa pun. Gagal: ganti model atau perbaiki prompt, catat versinya.
   - Temperature rendah (0 sampai 0,2) untuk Judge dan Questioner; sedikit lebih tinggi (sampai 0,4) untuk Report writer.
   - Catatan privasi: untuk hackathon hanya naskah milik Maou sendiri yang dikirim ke penyedia (butir 5). Peringatan privasi di layar unggah tetap wajib.

2. **Bahasa.** UI, pertanyaan boss, dan Kitab Nasihat: **Indonesia**. Naskah boleh Indonesia atau Inggris; kutipan selalu dalam bahasa asli naskah. Pengujian dan demo difokuskan ke naskah berbahasa Indonesia. Rules engine sudah memuat kata kunci Indonesia dan Inggris; tambah tes untuk keduanya.

3. **Embedding: Gemini `gemini-embedding-2`, 768 dimensi.**
   - Terverifikasi di dokumentasi Google: model stabil, dimensi bisa dikurangi lewat `outputDimensionality` (768 termasuk ukuran yang direkomendasikan), hasil terpotong dinormalisasi otomatis, mendukung "lebih dari 100 bahasa". **Belum terverifikasi:** bahasa Indonesia disebut secara eksplisit, dan harga/kuota gratis. Cek halaman harga sebelum dipakai.
   - Migration baru `20261030000500_embedding_dim.sql`: kunci `manuscript_chunks.embedding` jadi `vector(768)` dan tambah indeks `hnsw (embedding vector_cosine_ops)`. Batas HNSW untuk tipe `vector` adalah 2.000 dimensi (dokumentasi Supabase), jadi 768 aman. Isi `embedding_model` selalu.
   - Uji sanity retrieval sebelum Recon dibangun di atasnya: 10 pertanyaan tentang naskah Maou, potongan yang benar harus masuk top-3 pada **>= 8 dari 10** (ambang ditetapkan sebelum melihat hasil). Gagal: pakai fallback FTS dan catat.
   - Nama model bisa berubah; jangan hardcode di luar `lib/embed.ts` dan env `EMBEDDING_MODEL`.

4. **Ghost: salah tandai tidak memotong Heart.** Pemain punya **2 tebakan**. Tebakan salah menampilkan status referensi itu (asli / `needs_review`) dan dicatat di `ghost_checks`; setelah tebakan kedua salah, jawabannya diungkap. Laporan mencatat "menuduh referensi asli: N kali". Alasan: cakupan Crossref/OpenAlex tidak lengkap (buku dan prosiding sering tidak terindeks), jadi menghukum tebakan itu tidak adil, dan PRD sudah menyatakan temuan `needs_review` tanpa biaya Heart.

5. **Naskah demo dan pilot.**
   - Demo: naskah **milik Maou sendiri** yang lengkap (dengan daftar pustaka).
   - Tes regresi dan kalibrasi pilot: naskah **sintetis fiktif** dengan kelemahan yang sengaja ditanam dan kunci jawabannya (`fixtures/manuscripts/`).
   - Naskah mahasiswa lain: hanya dengan izin tertulis, dan tidak sebelum hackathon.

6. **Kitab Nasihat tidak berisi kalimat tulis ulang.** Tetap pertanyaan dan checklist. Tinjau ulang setelah ada data `pilot_feedback.advice_usefulness`.

### Dari keputusan sebelumnya (tetap berlaku)
- Bentuk serangan boleh diulang setelah semua bentuk terpakai, asalkan tidak berturut-turut dan pertanyaannya beda (bagian 8).
- Input naskah: .docx / PDF berteks, ekstraksi di browser (bagian 9).
- `MINION_HP = 100`; beda boss dan antek lewat `HIT_CAP` (bagian 7).
- Ambang confidence rendah 0,5.
- Naskah harus lengkap, termasuk daftar pustaka. Ghost selalu dimainkan (bagian 9).
- Jumlah referensi: gerbang keras hanya "minimal 1 entri terparse" atau angka pedoman yang diisi pemain; default per tahap hanya peringatan (bagian 9).

### Masih terbuka (tanya Maou)
- Provider dan model LLM yang akhirnya dikunci (menunggu hasil uji butir 1).
- Harga dan kuota embedding yang dipakai (menunggu pengecekan butir 3).

### Catatan arsitektur yang harus diingat
- Di M2, route `/api/encounter/answer` menerima `hp`, `hearts`, `sourceText` dari client. Itu bisa dicurangi dan bertentangan dengan aturan bagian 6 (state permainan ditulis server). Dibiarkan di M2 dengan komentar `TODO(M3)`; **di M3 state encounter dihitung dan disimpan server**, client hanya mengirim jawaban.

## 12. Milestone dan Definition of Done

Tiap milestone: tes unit lolos (`vitest`), `tsc --noEmit` bersih, `next build` sukses, dan cek manual di browser.

**M1: Peta jalan**
- Next.js + Tailwind + Phaser terpasang; Phaser hanya di client.
- Aset Kenney di `public/assets/tiny-dungeon/`, ukuran tile dicatat dari file asli, `CREDITS.md` ada.
- `generateFloor` dari **5 temuan dummy hardcode** (sebar di 2+ lantai) + tes unit (jumlah ruang = jumlah temuan, ruang boss terakhir dan lebih besar, tangga ada, deterministik per seed, lantai kosong dilewati).
- Pemain bisa berjalan (keyboard), menabrak dinding, masuk ruang, memicu overlay encounter React berisi pertanyaan dummy. Pintu terkunci/terbuka berfungsi dengan tombol "selesai" dummy.

**M2: Loop pertarungan**
- `lib/balance.ts`, validator kutipan, rules engine, damage, dengan Judge **dummy** (JSON hardcode/heuristik) di balik `lib/llm.ts`.
- HP boss/antek, Heart, `missing`, bar skor per kriteria, Objection!, Kitab Nasihat (templat), turun lantai, kalah dan ulang lantai.
- Tes wajib "jawaban asal tidak one-shot" (bagian 8) dan tes tiap aturan deterministik.

**M3: Backend**
- Supabase terhubung, `supabase db reset` sukses dengan migration yang ada (laporkan hasilnya).
- Auth, unggah naskah .docx / PDF berteks (ekstraksi di browser), peringatan privasi, **cek kelengkapan** dengan checklist bagian yang kurang (tes: naskah tanpa daftar pustaka ditolak; proposal tanpa hasil tetap lolos; `min_references = 20` dengan 12 entri ditolak; tanpa `min_references`, skripsi dengan 12 entri lolos dengan peringatan), ekstraksi Research Map, layar konfirmasi.
- Chunking + embedding + simpan ke `manuscript_chunks`, fallback FTS bila embedding belum ada.

**M4: Recon nyata**
- Detektor kode + detektor LLM, validator, ranking, planner menghasilkan dungeon dari temuan asli. Recon async dengan layar progres; waktu tiap langkah tercatat dan dilaporkan.

**M5: Ghost + sidang akhir + report + revise-run.**

**M6: Polish**: suara (default mati), minimap, D-pad mobile, pesan error, halaman about, `CREDITS.md` final.

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
