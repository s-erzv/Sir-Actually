# Rencana RAG: Sir, Actually

Status: **R0 + R1 hybrid sudah diimplementasikan**; evaluasi retrieval dan tuning belum. Diperbarui 1 Nov 2026.
Dokumen ini mengikat untuk M4 dan menggantikan versi sebelumnya. Aturan main ada di `docs/BRIEF.md` §7–§13.

### Status implementasi

- **R0 selesai:** `lib/rag/` ada, Recon memakai retrieval per klaim (bukan `.limit(24)`), migration grant `service_role` ditambahkan, placeholder key ditolak, kutipan dideteksi terhadap chunk hasil retrieval.
- **R1 hybrid selesai:** `retrieveChunks` memakai FTS + vektor Gemini (jika key valid), digabung RRF; fallback FTS kalau embedding/RPC gagal.
- **R3 selesai:** `/api/encounter/question` memakai findings, claims, `weakness_types.attack_types`, dan retrieval.
- **R4 selesai:** Judge + Debrief memakai retrieval; tidak ada fallback dummy.
- **Belum:** jalankan migration di Supabase sungguhan, backfill vektor chunk lama (`pnpm backfill:embeddings`), evaluasi recall/top-3, holdout, tuning.
- **Belum:** neighbor expansion, query lintas bagian, evaluasi otomatis di CI.

---

## 0. Ringkasan

RAG di proyek ini bukan hiasan. Tiga hal yang harus benar:

1. **Recon tidak boleh buta bagian belakang naskah.** Dulu sistem mengambil 24 chunk pertama, jadi kesimpulan dan daftar pustaka tidak pernah dianalisis. Sekarang retrieval per klaim.
2. **Pertanyaan, judge, dan debrief harus melihat potongan naskah yang relevan**, bukan seluruh naskah dan bukan potongan acak.
3. **Setiap kutipan harus bisa dilacak.** Kalau model mengarang kutipan, output dibuang; bukan dipercaya.

Ambang yang ditetapkan **sebelum** melihat hasil:

| Uji | Ambang |
|---|---|
| Retrieval: potongan benar masuk top-3 | ≥ 8 dari 10 pertanyaan uji |
| Retrieval: recall@6 pada kelemahan yang ditanam | ≥ 0,80 |
| Output JSON valid (semua LLM) | ≥ 95% |
| Kutipan lolos validator (Recon) | ≥ 90% |
| Kutipan lolos validator (Questioner/Debrief) | 100% setelah 1 retry; kalau gagal, fallback templat |
| Pertanyaan ≤28 kata dan satu tanda tanya | ≥ 95% |
| Pertanyaan yang bisa dijawab dari naskah | ≥ 17 dari 20 sampel manual |
| Duplikat `question_hash` per finding | 0 |
| Jawaban asal tidak pernah level 2 | 100% pada set uji |

Kalau gagal, laporkan angkanya. Jangan menurunkan ambang setelah melihat hasil.

---

## 1. RAG singkat

Bayangkan asisten yang hanya boleh menjawab dari satu naskah.

- **Tanpa RAG**: seluruh naskah (50–100 halaman) dikirim tiap pertanyaan. Mahal, lambat, dan model mulai melupakan bagian tengah.
- **Dengan RAG**: naskah dipotong jadi kartu ~300 kata, tiap kartu diberi embedding. Saat butuh, sistem mencari 4–8 kartu paling relevan, lalu **hanya kartu itu** yang dikirim ke model.

RAG = **cari dulu, baru tanya**. Yang membuatnya akurat bukan modelnya, melainkan:
- potongan yang diambil memang relevan;
- model hanya boleh mengutip dari potongan itu;
- validator menolak kutipan yang tidak ada;
- kalau bukti tidak cukup, sistem bilang "tidak ditemukan", bukan mengarang.

---

## 2. Fakta kode saat ini (sudah dicek)

| Bagian | Lokasi | Status |
|---|---|---|
| Potong naskah per heading | `lib/manuscript/chunk.ts:24` | Jalan, target ~300 kata |
| Panggil embedding | `lib/embed.ts` | Jalan untuk Gemini/OpenAI; provider lokal belum diimplementasi |
| Simpan chunk + vektor | `app/api/manuscripts/route.ts:149` | Jalan |
| Tabel chunk | `supabase/migrations/20261101000100_init_schema.sql:84` | `embedding vector(768)` **sudah dikunci**; tidak perlu migration dimensi baru |
| FTS generated | migration baris 86 | `to_tsvector('simple', text)` |
| RPC vektor | migration baris 959 | Ada, **belum pernah dipanggil** |
| RPC FTS | migration baris 926 | Ada, **belum pernah dipanggil** |
| Grant RPC | migration baris 994–997 | Hanya `authenticated`, **belum** `service_role` |
| Retrieval Recon | `app/api/recon/[id]/run/route.ts` | **Sudah** memakai `lib/rag/retrieve.ts` per klaim |
| `lib/rag/` | `lib/rag/retrieve.ts` | **Ada**: FTS + vektor + RRF |
| Questioner nyata | `lib/prompts/questioner_v1.ts` + `app/api/encounter/question/route.ts` | Route nyata; findings/claims/attack_types/retrieval dari DB |
| Embedding key | `.env.local` | Sudah diisi; `getEmbeddingConfig()` menolak placeholder `YOUR_` |
| Evaluasi retrieval | — | Belum ada skrip/angka |

### 2.1 Kesimpulan dari fakta di atas

- **R0 bisa dikerjakan tanpa API key baru.** FTS + perbaikan grant sudah menambal bug terbesar.
- **R1 butuh provider embedding yang benar-benar bisa dipanggil:** lokal `multilingual-e5-base` (tanpa key) atau Gemini/OpenAI (dengan key). Tanpa itu, tetap FTS.
- **Kagiro tidak punya model embedding.** Sudah diuji: 22 model chat, `POST /v1/embeddings` 404 untuk semua kandidat. Kagiro tetap dipakai untuk chat/LLM.
- **Validasi kutipan Recon sekarang longgar.** `detectLlmFindings` mengecek kutipan terhadap seluruh `sourceText`, bukan terhadap chunk yang di-retrieve. Akibatnya model bisa mengutip bagian yang tidak pernah dilihatnya dan tetap lolos. Ini harus diperketat.

---

## 3. Prinsip akurasi

1. **Grounded**: output LLM hanya boleh memakai isi chunk yang diberikan. Kutipan di luar chunk = dibuang.
2. **Checkable**: setiap temuan, pertanyaan, dan debrief membawa `quote` + `chunk_index`/`section_label`. UI bisa menunjuk sumbernya.
3. **Abstain**: retrieval kosong atau skor rendah → "tidak ditemukan bukti", bukan temuan baru.
4. **Rubric-first**: retrieval membantu menemukan bukti; skor tetap dari rubrik dan damage dihitung kode.
5. **No cross-version leakage**: filter selalu `manuscript_id + version + embedding_model`. Chunk versi lama tidak boleh muncul.
6. **Server-only**: embedding, retrieval, LLM, dan service role hanya di route server. Browser tidak pernah melihat vektor, API key, atau seluruh chunk.
7. **Versioned**: prompt, model, `embedding_model`, dan `rubric_version` disimpan di tiap output.
8. **One question, one anchor**: pertanyaan tanpa `anchor_quote` yang valid tidak boleh tampil.

---

## 4. Arsitektur target

```
Upload (browser)
  → ekstraksi teks + heading
  → chunkManuscript (300 kata, per heading)
  → embedTexts (batch, lokal 768 atau API bila ada key)
  → manuscript_chunks (text, section_label, char offsets, embedding, embedding_model, fts)

Recon (server, async)
  → retrieve per claim (hybrid vector+FTS, top-k, neighbor)
  → detektor kode (tanpa LLM)
  → detektor LLM (hanya chunk hasil retrieval)
  → validator quote ⊆ chunk
  → ranking → floor plan

Encounter (server)
  → questioner: retrieve konteks finding → JSON pertanyaan + anchor_quote
  → judge: evidence_quote + konteks sekitar → rubrik → damage
  → lost: debrief: retrieve bukti → JSON 4 bagian → validator

Report
  → finding + evaluation + citations (tanpa retrieval baru)
```

Modul baru:

```
lib/rag/
  types.ts        RetrievedChunk, RetrievalResult
  query.ts        query builder per use case + multi-section
  retrieve.ts     hybrid retrieval + fallback
  rrf.ts          Reciprocal Rank Fusion (fungsi murni)
  neighbors.ts    perluas chunk_index ±1 dalam section yang sama
  validate.ts     normalisasi + cek substring
lib/embed.ts      antarmuka provider; tambah provider `local`
lib/embed.local.ts pipeline feature-extraction + cache model
```

---

## 5. Ingestion dan index

### 5.1 Chunking

- **Sumber tunggal adalah Markdown kanonik** (`research_maps.source_text`), hasil konversi `.docx`/PDF berteks/`.md`/`.txt` di browser. Chunking, kutipan, dan validator memakai Markdown ini; tidak ada teks kedua.
- Markdown polos: heading, paragraf, daftar, tabel; tanpa `**bold**`/HTML inline, supaya kutipan bersih.
- Pertahankan `chunkManuscript` (heading-aware, target 300 kata).
- `section_label` wajib; kalau heading tidak terdeteksi, isi `null` dan tampilkan "Bagian tidak berlabel" di UI.
- Simpan `char_start`/`char_end` supaya kutipan bisa ditunjuk balik ke naskah asli.
- **Daftar pustaka** dipotong terpisah dari badan naskah; jangan dicampur ke chunk pembahasan. Retrieval sitasi memakai `citations.raw_text`, bukan chunk.
- Jangan memotong di tengah kalimat. `chunkManuscript` sudah menggabungkan paragraf; tambahkan tes yang memastikan tidak ada chunk berakhir dengan potongan kata.
- Untuk PDF, buang header/footer berulang sebelum chunking (deteksi baris yang muncul >50% halaman). Ini menaikkan kualitas retrieval jauh lebih besar daripada mengganti model embedding.
- **Tabel jangan dipecah sembarangan.** Simpan header + baris dalam satu chunk kalau muat. Kalau tabel lebih besar dari target, pecah per kelompok baris dan **ulangi header** di tiap chunk. `section_label` menyertakan caption tabel.
- **Angka dan satuan** dipertahankan apa adanya (`p = 0,03`, `R² = 0,41`, `n = 24`). Jangan membulatkan atau menormalkan angka saat chunking.
- **Campuran bahasa** Indonesia/Inggris: embedding lokal multilingual menangani keduanya; FTS `simple` hanya cocok kata persis, jadi jangan mengandalkan FTS untuk parafrase lintas bahasa.

### 5.2 Embedding

- **Default runtime: hybrid.** Vektor dipakai kalau `EMBEDDING_API_KEY` valid; FTS tetap jalan kalau embedding/RPC gagal. Tanpa key, FTS adalah fallback.
- **Upgrade lokal (disarankan kalau recall <0,80):** `Xenova/multilingual-e5-base`, 768 dimensi, jalan di Node server. Tanpa API key. Wajib prefix `query: ` untuk query dan `passage: ` untuk chunk; potong input >512 token. Unduh ~280 MB sekali, cache di disk. Cocok untuk demo lokal; cek ukuran image/cold start kalau deploy serverless.
- **Gemini/OpenAI** hanya kalau ada key valid; bukan prasyarat.
- `EMBEDDING_API_KEY` harus valid sebelum R1. `getEmbeddingConfig()` harus menolak nilai yang diawali `YOUR_` supaya tidak ada panggilan 401 yang diam-diam.
- Batch maksimal 100 teks per request; kalau gagal, retry sekali dengan batch lebih kecil.
- Simpan `embedding_model` di setiap baris. Jangan mencampur model dalam satu versi naskah.
- Backfill idempoten: `scripts/backfill-embeddings.mjs` memproses satu `manuscript_id + version`, melewati baris yang sudah punya vektor dengan model yang sama.
- Naskah baru: embed saat upload (sudah ada). Kalau embedding gagal, chunk tetap disimpan tanpa vektor dan `embeddingWarning` ditampilkan; retrieval jatuh ke FTS.

### 5.2b Alternatif model embedding

"Lebih baik" harus diukur di naskah sendiri, bukan dari klaim MTEB. Untuk naskah akademik Indonesia, kandidat yang masuk akal:

| Kandidat | Dim | Jalan di | Catatan |
|---|---:|---|---|
| **Tanpa model (FTS)** | — | Postgres | default MVP; nol biaya, nol download |
| `intfloat/multilingual-e5-base` | 768 | lokal | cocok schema; prefix `query:`/`passage:`; 512 token |
| `BAAI/bge-m3` | 1024 | lokal/API | multibahasa kuat, konteks panjang; butuh migration dimensi + lebih berat |
| `intfloat/multilingual-e5-large` | 1024 | lokal/API | kualitas lebih tinggi, lebih lambat, butuh migration |
| OpenAI `text-embedding-3-small` | 1536 (bisa dipotong) | API | murah, stabil; butuh key; dimensi bisa disetel |
| Gemini `gemini-embedding-2` | 768 (bisa dipotong) | API | dulu dipilih karena cocok schema + free tier; butuh key |
| Cohere `embed-multilingual-v3` | 1024 | API | kualitas baik; berbayar; butuh key |

Catatan:
- `bge-m3`/`e5-large` tidak cocok dengan `vector(768)` sekarang; pilih hanya kalau siap migration + backfill.
- Jangan pakai model Inggris-only (`nomic-embed-text`, `all-MiniLM`) untuk naskah Indonesia; recall bahasa Indonesia akan turun.
- Jangan mencampur model dalam satu versi naskah; `embedding_model` wajib diisi.
- Ukur dengan set 10 pertanyaan + recall@6 yang sama. Model yang menang di MTEB belum tentu menang di naskah 30 halaman.
- Untuk MVP, urutan biaya/manfaat: **FTS → e5-base 768 → OpenAI small → bge-m3/e5-large**.

**Biaya Gemini Embedding 2 (teks), dicek 1 Nov 2026:** $0,20 per 1 juta token input; batch $0,10. Free tier tersedia, tetapi input free tier boleh dipakai untuk meningkatkan produk Google. Estimasi kasar naskah 30 halaman (~20.000 token) = **$0,004** sekali embed; 100 naskah = **$0,40**. Query per pertanyaan jauh lebih kecil. Jadi mahal bukan dari harga per token, tapi dari kebutuhan key/billing dan ketergantungan API. OpenAI `text-embedding-3-small` $0,02/1 juta token (10x lebih murah); lokal e5-base gratis.

### 5.2c Free tier Gemini (boleh untuk demo)

Langkah:

1. Buka `aistudio.google.com`, login akun Google.
2. **Get API key** → buat project baru (tanpa billing).
3. Salin key ke `.env.local`:
   ```bash
   EMBEDDING_PROVIDER=gemini
   EMBEDDING_MODEL=gemini-embedding-2
   EMBEDDING_API_KEY=...
   EMBEDDING_DIMENSIONS=768
   ```
4. Cek key hanya dipakai di server. Jangan `NEXT_PUBLIC_*`, jangan commit `.env.local`.
5. Tes satu teks, pastikan `values.length === 768`.
6. Buka halaman rate limit di AI Studio untuk project itu. Google tidak lagi mencetak angka di docs; angka di UI yang berlaku. Laporan Okt 2026 menyebut sekitar **1.000 request/hari** untuk Gemini Embedding 2 per project, tetapi bisa berubah.

Batas dan risiko:

- **Biaya:** selama tidak ada billing account terhubung, tidak ada tagihan. Jangan link billing kalau tidak perlu.
- **Privasi:** free tier boleh memakai input untuk meningkatkan produk Google. Hanya unggah naskah sendiri atau yang ada izin. Untuk naskah mahasiswa lain, pakai paid tier atau embedding lokal.
- **Rate limit:** per project, bukan per key. Jangan buat banyak project untuk menembus limit.
- **Batch:** free tier tidak mendapat harga batch; panggilan sinkron tetap jalan.
- **Kalau 429:** backoff, kecilkan batch, atau fallback FTS; jangan retry agresif.
- **Kalau free tier dihentikan/diubah:** rencana tetap punya FTS dan lokal e5-base.

### 5.3 Index

- `vector(768)` sudah ada. **Jangan** menambah migration dimensi.
- HNSW **belum** perlu: naskah hanya puluhan–ratusan chunk; sequential scan <10 ms. Tambah hanya kalau p95 retrieval >200 ms atau chunk >5.000.
- FTS tetap `simple` sampai diuji di Postgres sungguhan. `indonesian` belum tentu tersedia di semua image; jangan ganti berdasarkan dugaan.
- Migration baru hanya untuk grant:

```sql
-- 20261101000300_rag_permissions.sql
grant execute on function public.search_manuscript_chunks_fts(text, uuid, integer, integer)
  to service_role;
grant execute on function public.match_manuscript_chunks(extensions.vector, uuid, integer, integer, text)
  to service_role;
```

Verifikasi di Supabase sungguhan, bukan PGlite. Kalau `auth.role()` di dalam fungsi `security definer` tidak mengembalikan `service_role`, perbaiki fungsi, bukan hanya grant.

---

## 6. Retrieval

### 6.1 Kontrak

```ts
type RetrieveInput = {
  manuscriptId: string;
  version: number;
  query: string;
  k?: number;              // default 6
  embeddingModel?: string; // default env
  minSimilarity?: number;  // default 0.40, belum dikalibrasi
};

type RetrievedChunk = {
  id: string;
  chunkIndex: number;
  sectionLabel: string | null;
  text: string;
  score: number;
  source: "vector" | "fts";
};

type RetrievalResult = {
  chunks: RetrievedChunk[];
  strategy: "hybrid" | "vector" | "fts" | "none";
  topSimilarity: number | null;
  insufficientEvidence: boolean;
};
```

### 6.2 Urutan pencarian

1. **Vector**: embed query sekali → `match_manuscript_chunks` → ambil 20.
2. **FTS**: `search_manuscript_chunks_fts` dengan teks query yang sudah dibersihkan → ambil 20.
3. **Gabung RRF**: `score = Σ 1/(60 + rank_i)`. Jangan menormalkan skor vektor dan FTS; cukup urutan.
4. **Filter**: buang chunk dengan similarity < `minSimilarity` **hanya** untuk jalur vektor; chunk FTS tetap boleh masuk kalau cocok kata kunci.
5. **Neighbor**: untuk 3 hasil teratas, tambah `chunk_index ± 1` dalam `section_label` yang sama. Maksimal 2 chunk tambahan per hasil. Ini mencegah kutipan menggantung.
6. **Batas token**: total konteks maksimal ~3.500 token (≈14.000 karakter). Buang chunk terendah kalau lebih.
7. **Fallback**: kalau vector kosong → FTS. Kalau FTS kosong → **jangan** fallback ke "24 chunk pertama" untuk LLM; kembalikan `insufficientEvidence`. Fallback slice hanya boleh untuk layar debug/Recon non-LLM, dan harus ditandai.
8. **Top-1 rendah**: kalau `topSimilarity < minSimilarity` dan FTS juga kosong, `insufficientEvidence = true`; detektor LLM tidak boleh membuat temuan dari konteks kosong.

### 6.3 Query per pemakai

| Pemakai | Query | k | Konteks tambahan |
|---|---|---:|---|
| Recon per klaim | `claims.text` + nama `weakness_type` + sinonim | 6 | chunk sekitar |
| Questioner | `finding.evidence_quote` + `claims.text` + `attack_type` | 4 | chunk sekitar + pertanyaan sebelumnya |
| Judge | `finding.evidence_quote` | 3 | chunk sekitar + rubrik |
| Debrief | `finding.evidence_quote` + jawaban pemain + `missing` | 3 | chunk sekitar |
| Report | tidak perlu retrieval baru | — | pakai finding + evaluation |

Recon **wajib** satu retrieval per klaim, bukan satu retrieval untuk seluruh naskah. Batas: maksimal 25 klaim per langkah; kalau lebih, proses bertahap dan simpan `cursor`.

### 6.4 Retrieval lintas bagian

Beberapa kelemahan tidak bisa dibuktikan dari satu bagian. Contoh: `objective_rq_mismatch` butuh tujuan **dan** RQ; `rq_method_mismatch` butuh RQ **dan** metode; `abstract_result_mismatch` butuh abstrak **dan** hasil. Kalau hanya satu sisi yang diambil, model akan menilai dari separuh bukti.

Aturan:

- `buildQuery(claim, weaknessType)` boleh mengembalikan **maksimal 2 query** (sisi A dan sisi B).
- Jalankan retrieval untuk masing-masing query, lalu gabung dengan RRF yang sama.
- Setelah digabung, pastikan **minimal 1 chunk dari tiap sisi** masuk hasil akhir kalau sisi itu ada di naskah.
- Kalau satu sisi tidak ditemukan, set `insufficientEvidence = true` dan `missingSide = "method"` (contoh). Detektor LLM tidak boleh membuat temuan lintas bagian dari satu sisi saja; kalau tetap membuat, `confidence` maksimal 0,4 dan masuk ruang opsional.
- Simpan `retrieval_sides` di log: `{ a: [...ids], b: [...ids], merged: [...] }`.

Tabel sisi:

| Weakness | Sisi A | Sisi B |
|---|---|---|
| `problem_objective_gap` | problem | objective |
| `objective_rq_mismatch` | objective | rq |
| `rq_method_mismatch` | rq | method |
| `abstract_result_mismatch` | abstract | result |
| `generalization_beyond_sample` | method/sample | conclusion |
| `citation_claim_mismatch` | claim | citation |

### 6.5 Normalisasi kutipan

Validator memakai satu fungsi yang sama untuk semua jalur:

```ts
function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
    .toLowerCase();
}
```

- Bandingkan `normalizeForMatch(quote)` dengan `normalizeForMatch(chunk.text)`.
- Tampilkan kutipan asli (bukan hasil normalisasi) di UI.
- Jangan memakai `includes` pada teks mentah; PDF sering menghasilkan ligatur dan spasi ganda.

---

## 7. Pipeline per pemakai LLM

### 7.0 Cartographer (lapis 1)

Cartographer **tidak** memakai retrieval per klaim dan **tidak** menciptakan temuan. Input: findings hasil Recon + ringkasan Markdown + Research Map + katalog boss/minion. Output: `DungeonDraft` (tema, lore, usulan pengelompokan, usulan monster).

Validasi kode:
- setiap `finding_id` ada dan hanya dipakai sekali; semua finding wajib kebagian monster;
- `dimension` cocok dengan `weakness_type`;
- boss = rank 1 (paling berat);
- maksimal 3 monster per ruang (pemadatan ruang);
- urutan lantai = severity rata-rata naik, Ghost dan Takhta terakhir.

Usulan yang melanggar dibuang; `buildFloorPlan` deterministik tetap menghasilkan dungeon. Cartographer tidak boleh menambah finding, sitasi, atau angka.

### 7.0b Warden (lapis 2)

Warden adalah nama untuk tiga pemanggil yang sudah ada di bawah: **Questioner**, **Judge**, dan **Debrief**. Mereka dipanggil per monster, bukan per naskah, dan semuanya memakai retrieval yang sama.

- Questioner: 4 chunk + neighbor + pertanyaan sebelumnya.
- Judge: 3 chunk sekitar `evidence_quote` + rubrik + angka naskah.
- Debrief: 3 chunk + jawaban pemain + kriteria yang gagal.

Warden tidak boleh mengubah `RoomPlan`, menambah monster, atau mengarang temuan. Kalau output gagal validasi, fallback ke templat; room tetap bisa dimainkan.

### 7.1 Recon (detektor LLM)

Input yang dikirim:
- klaim (teks + `source_quote`),
- daftar sitasi,
- **hanya chunk hasil retrieval** untuk klaim itu,
- temuan yang sudah ada (untuk dedupe),
- `weakness_types` yang relevan.

Output wajib JSON:
```json
{
  "findings": [{
    "claim_index": 0,
    "weakness_type": "sample_unreported",
    "evidence_quote": "…",
    "chunk_index": 14,
    "severity": 2,
    "centrality": 2,
    "confidence": 0.7
  }]
}
```

Aturan:
- `evidence_quote` harus substring dari chunk dengan `chunk_index` yang diklaim.
- `chunk_index` harus ada di hasil retrieval untuk klaim itu.
- Kalau model mengembalikan kutipan dari `sourceText` yang tidak ada di chunk, **buang** dan tambah `recon_jobs.discarded`.
- Kalau tidak ada temuan, kembalikan array kosong; jangan memaksa satu temuan per klaim.
- Dedupe: `(weakness_type, normalized_quote)` unik.

### 7.2 Questioner

Input: finding + `evidence_quote`, Research Map ringkas, persona boss, `attack_type` dari planner, pertanyaan sebelumnya, **4 chunk hasil retrieval + neighbor**.

Output wajib JSON:
```json
{
  "question": "…",
  "anchor_quote": "…",
  "attack_type": "numbers",
  "target_criteria": ["sample_justified", "numbers_consistent"]
}
```

Validator:
- `question` ≤28 kata, tepat satu `?`, bukan pertanyaan ya/tidak, tidak mengandung jawaban.
- `anchor_quote` substring dari salah satu chunk yang diberikan.
- `target_criteria` ⊆ kriteria rubrik untuk `weakness_type`.
- `attack_type` = yang diminta planner.
- `question_hash` belum pernah dipakai di finding ini.
- Kemiripan trigram dengan pertanyaan sebelumnya <0,85.

Gagal → tulis ulang sekali → masih gagal → pakai templat deterministik dari `lib/prompts/questioner_v1.ts`, catat `question_source = 'template'`.

### 7.3 Judge

Input: jawaban pemain, rubrik, `evidence_quote`, **3 chunk sekitar bukti**, angka dari naskah (`extractNumbers`), `knownCitations`.

Aturan:
- Judge menilai **dukungan bukti dan konsistensi**, bukan kebenaran domain.
- `quote` di output judge harus substring jawaban pemain (sudah ada validator).
- Rules engine tetap membatasi level; retrieval tidak boleh menaikkan level.
- Kalau chunk sekitar tidak ditemukan, judge tetap jalan dengan `evidence_quote` saja; catat `retrieval_insufficient`.

### 7.4 Debrief (Catatan Penjaga / Epitaf)

Input: finding, evaluasi terakhir, jawaban pemain, 3 chunk hasil retrieval, daftar kriteria yang gagal.

Output wajib JSON:
```json
{
  "what_failed": "…",
  "criterion_id": "sample_justified",
  "answer_quote": "…",
  "evidence_quote": "…",
  "evidence_chunk_index": 14,
  "question_back": "…",
  "tactical_hint": "…"
}
```

Validator:
- `answer_quote` substring jawaban pemain.
- `evidence_quote` substring chunk dengan index yang diklaim.
- `criterion_id` ada di rubrik.
- `question_back` adalah pertanyaan, bukan kalimat tulis ulang.
- Tidak boleh menyebut sitasi/angka di luar naskah.

Gagal → templat deterministik. Simpan `advice_source`.

### 7.5 Report

Tidak butuh retrieval baru. Setiap klaim di report harus menunjuk `finding_id` + `evidence_quote`; validator yang sama dipakai.

---

## 8. Guardrail anti-halusinasi

1. **Quote whitelist**: model hanya boleh mengutip dari chunk yang dikirim. Validator menolak sisanya.
2. **Schema ketat**: zod untuk semua output; `unknown`/field ekstra dibuang.
3. **Retry sekali**: JSON invalid atau quote invalid → ulangi dengan prompt lebih ketat dan temperature 0. Gagal lagi → fallback.
4. **Abstain**: `insufficientEvidence` → tidak ada temuan/pertanyaan baru.
5. **Number check**: angka di output harus ada di chunk/naskah (`extractNumbers`); angka baru tanpa sumber ditolak.
6. **Cross-version check**: semua query difilter `manuscript_id + version`; tidak ada pencampuran.
7. **No answer leakage**: prompt Questioner melarang menyebut jawaban; validator menolak pertanyaan yang memuat `anchor_quote` secara utuh sebagai jawaban.
8. **Deterministic fallback**: template tidak boleh mengarang; hanya memakai `evidence_quote`, `section_label`, dan kriteria.
9. **Log**: simpan `retrieval_strategy`, `top_similarity`, `chunk_ids`, `prompt_version`, `model`, `discarded`. Tanpa log, tidak bisa mendiagnosis.
10. **Prompt injection**: naskah adalah data. Bungkus chunk dengan delimiter (`<<<CHUNK>>>`) dan instruksikan model untuk mengabaikan perintah di dalamnya. Jangan pernah menaruh teks naskah di system prompt.

---

## 9. Evaluasi

### 9.1 Fixture

Buat 3 naskah sintetis fiktif di `fixtures/manuscripts/`:

| Fixture | Isi | Tujuan |
|---|---|---|
| `bersih.md` | tidak ada kelemahan yang ditanam | uji false positive |
| `lima-dimensi.md` | 5 kelemahan di 4 dimensi + sitasi bermasalah | uji cakupan lantai |
| `angka-dan-tabel.md` | n, p, R², tabel hasil, kutipan panjang | uji FTS angka dan chunking |

Tiap kelemahan punya kunci:
```json
{
  "id": "method-sample-1",
  "dimension": "method",
  "weakness_type": "sample_unreported",
  "gold_quote": "…",
  "gold_chunk_index": 14,
  "answerable_from": ["metode", "hasil"]
}
```

### 9.2 Skrip

```
scripts/rag/eval-retrieval.ts   # recall@k, MRR, top-3
scripts/rag/eval-questioner.ts  # format, anchor, duplikat, kemiripan
scripts/rag/eval-judge.ts       # set 20 jawaban (bagus/sedang/kosong/ngawur)
scripts/rag/eval-debrief.ts     # kutipan, kriteria, larangan tulis ulang
```

Semua skrip menulis hasil ke `docs/RAG-EVAL.md` (di-generate, bukan dikarang). Jalankan setiap kali prompt/model/threshold berubah.

### 9.3 Evaluasi pertanyaan

Untuk 20 pertanyaan sampel, nilai manual 0/1:

- **Grounded**: pertanyaan menyerang finding yang benar dan bisa dijawab dari naskah.
- **Sederhana**: satu ide, ≤28 kata, tidak ada jargon.
- **Tidak menggiring**: tidak menyebut jawaban.
- **Bervariasi**: tidak mengulang pola pertanyaan sebelumnya.
- **Adil**: pemain punya cukup informasi di layar (kutipan + bagian).

Ambang: ≥17/20 grounded dan ≥17/20 sederhana.

### 9.4 Holdout

Jangan mengukur dan menuning pada fixture yang sama. Pakai:
- **dev**: `bersih.md` + `lima-dimensi.md` untuk iterasi;
- **holdout**: `angka-dan-tabel.md` + naskah demo Maou, hanya dijalankan di akhir tahap.

Kalau holdout jauh lebih buruk, jangan klaim selesai.

---

## 10. Tahapan eksekusi

Aturan: tiap tahap harus berguna sendiri. Kalau tahap berikutnya batal, tahap sebelumnya tetap menambal bug nyata.

### R0 — Stop the bleeding (tanpa key baru)

**Ubah:**
- `lib/rag/retrieve.ts`: FTS-only `retrieveChunks`.
- `app/api/recon/[id]/run/route.ts`: ganti `.order().limit(24)` dengan retrieval per klaim.
- Migration grant `service_role`.
- `getEmbeddingConfig()` menolak placeholder `YOUR_`.
- `detectLlmFindings` menerima chunk hasil retrieval dan memvalidasi quote terhadap chunk itu.
- Fallback slice hanya untuk debug, ditandai `strategy: 'debug-slice'`.

**DoD:**
- Naskah sintetis 60 chunk: kelemahan di chunk ke-50 muncul di hasil retrieval.
- Tes unit `retrieveChunks` dengan RPC di-mock (hasil, kosong, error).
- Recon tidak lagi memakai 24 chunk pertama sebagai jalur utama.
- Angka dilaporkan: jumlah chunk, jumlah yang terambil, chunk ke-50 muncul/tidak.

**Risiko:** FTS `simple` tidak ber-stemming. Diterima untuk R0 karena ini jauh lebih baik daripada potong 24.

### R1 — Nyalakan vektor

**Prasyarat:** pilih salah satu — lokal `Xenova/multilingual-e5-base` (tanpa key), atau `EMBEDDING_API_KEY` valid + `EMBEDDING_MODEL` (Gemini/OpenAI). Default `EMBEDDING_DIMENSIONS=768`.

**Ubah:**
- `lib/rag/retrieve.ts`: jalur vector + threshold.
- `lib/embed.ts` + `lib/embed.local.ts`: provider lokal `Xenova/multilingual-e5-base` (768d) dengan prefix `query:` / `passage:`; atau API kalau ada key.
- `next.config.ts`: `serverExternalPackages` untuk paket transformers; route embedding wajib **Node runtime**, bukan Edge.
- `scripts/backfill-embeddings.mjs` idempoten.
- Tes: vektor 768, model tersimpan, filter model, prefix e5 dipakai.

**DoD:**
- Semua chunk naskah demo punya vektor (atau dilaporkan berapa yang `null`).
- Uji 10 pertanyaan: top-3 ≥8/10.
- Latency retrieval p95 dilaporkan.

**Kalau gagal:** tetap FTS, catat, jangan pura-pura lulus. Jangan menurunkan ambang.

### R2 — Hybrid + query per klaim + neighbor

**Ubah:**
- `lib/rag/rrf.ts` (fungsi murni + tes).
- `lib/rag/neighbors.ts`.
- Recon memakai query per klaim, bukan satu query naskah.
- Batas token dan dedupe.

**DoD:**
- Recall@6 ≥ R1 dan ≥0,80.
- Tes RRF: urutan, dedupe, hasil kosong, hasil hanya satu jalur.
- Waktu per langkah masuk `recon_jobs.timings`.

### R3 — Questioner grounded

**Ubah:**
- `lib/prompts/questioner_v1.ts`: output JSON + 5 templat per tipe.
- `app/api/encounter/question/route.ts` (baru).
- Planner memilih `attack_type`; validator memeriksa format, anchor, hash, kemiripan.
- UI memakai pertanyaan nyata; kalau gagal, tampilkan error + tombol coba lagi; tidak ada pertanyaan dummy.

**DoD:**
- 0 `question_hash` ganda per finding.
- ≥6 tipe serangan berbeda dalam satu run penuh (kalau ruang cukup).
- 20 sampel: ≥17 grounded, ≥17 sederhana.
- Fallback templat terbukti dipakai saat LLM gagal (tes).

### R4 — Judge + debrief memakai konteks

**Ubah:**
- Judge menerima 3 chunk sekitar bukti.
- `lib/prompts/advice_v1.ts` + route debrief.
- Validator kutipan debrief; fallback templat.
- Simpan `run_debriefs` (lihat BRIEF §13.6).

**DoD:**
- 100% kutipan debrief valid (setelah retry) pada set uji.
- Jawaban asal tidak pernah level 2.
- Debrief tidak pernah menulis kalimat pengganti naskah (cek manual 10 sampel).

### R5 — Harness evaluasi + regression gate

**Ubah:**
- Empat skrip evaluasi + `docs/RAG-EVAL.md`.
- CI lokal: `pnpm test` tetap; evaluasi dijalankan manual sebelum tag.

**DoD:**
- Semua ambang §0 diukur pada dev; holdout dijalankan sekali.
- Hasil buruk dilaporkan, bukan disembunyikan.

### R6 — Tuning (hanya setelah ada angka)

Satu variabel per percobaan:
- ukuran chunk 200 vs 300 vs 400 kata;
- `k` 4 vs 6 vs 8;
- threshold similarity 0,35 vs 0,40 vs 0,50;
- FTS `simple` vs `indonesian` (uji di Postgres sungguhan);
- batch embedding.

Catat hasil di `docs/RAG-EVAL.md`. Tanpa angka R1–R2, tuning cuma cocok-cocokan.

---

## 11. Biaya dan latency

| Bagian | Frekuensi | Catatan |
|---|---|---|
| Embedding chunk | sekali per naskah/versi | puluhan chunk, murah |
| Embedding query Recon | 1 per klaim | 10–25 per run |
| Embedding query Questioner | 1 per pertanyaan | ≈ 2× antek + 4× boss per run; tanpa cap monster |
| Embedding query Debrief | 1 per kalah | per monster, cache 1 |
| LLM Recon | per klaim | konteks lebih kecil setelah RAG |
| LLM Questioner | per pertanyaan | temperature 0–0,2 |
| LLM Debrief | per kalah | cache 1 per monster |

Target latency:
- retrieval p95 <300 ms untuk <200 chunk;
- Questioner p95 <4 detik;
- Debrief p95 <6 detik;
- Recon tetap dipecah per langkah; jangan menembus batas wall-clock Edge Function.

Cache query embedding di memori per `(manuscript_id, version, model, query_hash)`; jangan menambah tabel dulu.

---

## 12. Perubahan file/migration

Baru:
```
lib/rag/types.ts
lib/rag/query.ts
lib/rag/retrieve.ts
lib/rag/rrf.ts
lib/rag/neighbors.ts
lib/rag/validate.ts
lib/rag/retrieve.test.ts
lib/rag/rrf.test.ts
app/api/encounter/question/route.ts
lib/prompts/advice_v1.ts
lib/embed.local.ts
lib/dungeon/cartographer.ts
lib/dungeon/warden.ts
lib/prompts/cartographer_v1.ts
scripts/backfill-embeddings.mjs
scripts/rag/eval-retrieval.ts
scripts/rag/eval-questioner.ts
scripts/rag/eval-judge.ts
scripts/rag/eval-debrief.ts
supabase/migrations/20261101000300_rag_permissions.sql
fixtures/manuscripts/bersih.md
fixtures/manuscripts/lima-dimensi.md
fixtures/manuscripts/angka-dan-tabel.md
```

Diubah:
```
app/api/recon/[id]/run/route.ts     # retrieval per klaim
app/api/encounter/answer/route.ts   # konteks judge + state server (M3)
lib/recon/llmDetector.ts            # validasi quote terhadap chunk
lib/prompts/questioner_v1.ts        # JSON + templat
lib/env.ts                          # tolak placeholder key
lib/embed.ts                        # retry batch + model guard
docs/BRIEF.md                       # §7–§13 sudah diperbarui
```

Tidak perlu:
- migration `vector(768)` — sudah ada;
- indeks HNSW — belum;
- vector store eksternal — pgvector sudah cukup;
- reranker — belum ada masalah yang terbukti.

---

## 13. Sengaja TIDAK dikerjakan

- Reranker Cohere/BGE. Belum ada angka yang menunjukkan perlu.
- Chunking semantik berbasis LLM. 300 kata per heading cukup untuk naskah akademik.
- HNSW. Naskah puluhan–ratusan chunk; seq scan masih cepat.
- Vector DB eksternal. pgvector sudah satu database dengan RLS.
- Cache embedding persisten. Baru berguna kalau run diulang puluhan kali.
- Fine-tuning model. Rubrik + validator lebih murah dan lebih bisa diaudit.
- Jawaban otomatis untuk pemain. Game tidak menulis naskah.

---

## 14. Angka yang wajib dilaporkan tiap tahap

Tanpa ini, laporan milestone tidak sah:

- jumlah chunk per naskah;
- jumlah chunk dengan vektor vs `null`;
- recall@6 pada kelemahan yang ditanam;
- uji 10 pertanyaan: berapa yang top-3;
- jumlah kutipan ditolak validator (Recon/Questioner/Debrief);
- jumlah pertanyaan fallback templat;
- duplikat `question_hash`;
- durasi tiap langkah retrieval (ms);
- hasil 20 sampel pertanyaan (grounded/sederhana);
- hasil holdout, termasuk yang gagal.

---

## 15. Keputusan yang dipakai

1. **Embedding: default FTS; upgrade lokal `Xenova/multilingual-e5-base` 768 dimensi.** Alasan: Kagiro tidak punya endpoint embedding, Gemini butuh key yang belum tersedia, dan ukuran 768 sudah cocok dengan schema. Risiko: model lokal menambah ~280 MB + cold start; kalau deploy serverless tidak ramah, tetap FTS. Jangan mengarang vektor.
2. **Chat LLM: tetap lewat `lib/llm.ts` dan routing Kagiro yang ada.** RAG tidak mengubah provider chat.
3. **Query per klaim, bukan per naskah.** Jumlah klaim mahasiswa biasanya 10–25; masih puluhan call, bukan ratusan.
4. **Naskah uji: fixture sintetis dulu, naskah demo Maou untuk holdout.** Naskah mahasiswa lain hanya dengan izin.
5. **Fallback FTS wajib dites di Supabase sungguhan.** `simple` dipertahankan sampai ada bukti `indonesian` lebih baik.
6. **Tidak ada klaim "akurat" tanpa angka.** Akurasi di sini berarti: kutipan valid, retrieval mengenai chunk yang benar, pertanyaan bisa dijawab, dan sistem berani bilang "tidak ditemukan".
