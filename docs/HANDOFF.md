# Handoff: Dungeon RPG v2

Branch `game-overhaul`. Baca dulu: `docs/superpowers/specs/2026-11-17-dungeon-rpg-v2-design.md` (aturan), `docs/superpowers/plans/2026-11-17-dungeon-rpg-v2.md` (tugas), `docs/BRIEF.md` (produk). Skill proyek ada di `.claude/skills/` (game-feel, game-ui-ux, input-systems, phaser-core, audio-design, camera-systems, level-design).

Inti produk yang tidak boleh hilang: setiap serangan adalah **jawaban atas pertanyaan tentang naskah pemain**; mutu jawaban menentukan damage. Monster tidak boleh mengarang temuan.

## Sudah selesai (server dan aturan, bertes)

- `lib/combat/`: `quality.ts` (mutu 0-5), `monsterStats.ts` (level, HP, ATK, perlengkapan), `resolve.ts` (senjata dasar/andalan, serangan balik, tameng), `shop.ts` (dompet, tas ramuan), `playerHp.ts`. Semua angka di `lib/balance.ts` (bagian bawah).
- `app/api/encounter/answer`: memakai aturan baru, HP pemain di `runs.hearts_left` (1 Heart = 100 HP), penjaga double-submit lewat klaim `questions_asked`. Respons: `combat`, `hp`, `hpMax`, `newHearts`, `monsterLevel`, `monsterHpMax`.
- `state`, `run/start`, `run/active`, `run/retry` mengembalikan `hp`, `hpMax`, `hearts`, `heartsMax`.
- `app/api/run/shop` (GET/POST), `app/api/run/potion`, `run/loot` (bisa memberi ramuan, kunci jalan buntu `f<n>-nook:x,y`).
- Rank dari poin kotor (`run/finish`). `FLOOR_LAYOUT_VERSION` = 8 (run lama tertutup otomatis).
- Penghuni (monster pengisi): `lib/dungeon/dwellers.ts`, `dwellerClaim.ts`, pos di `FloorMap.dwellerSpots` (labirin), rubrik `COMPREHENSION_RUBRIC`, cabang di `lib/encounter/generate.ts` dan answer route.
- Labirin: `game/map/labyrinth.ts`. Judge v2, Recon 4 spesialis, model default `glm-5-3-flash`.
- Aset Ninja Adventure (CC0) sudah dipasang: karakter, potret, monster, boss, musik, SFX. Zip sumber ada di root proyek (di-gitignore).

Status tes saat handoff: `pnpm vitest run` hijau (251). `tsc` hanya punya 2 error di `components/encounter/EncounterOverlay.tsx` (baris ±206 dan ±258: `EncounterTopic` masuk ke fungsi yang minta `WeaknessType`); itu bagian Tugas B.

## Yang belum

### Server (kecil, kerjakan dulu)
1. **Endpoint jumlah penghuni.** `dwellerCountsByFloor()` sudah ada di `lib/dungeon/dwellerClaim.ts` tapi belum dipanggil. Tambahkan ke respons `/api/dungeon/plan` (atau `run/active`) supaya halaman main bisa memanggil `placeDwellers(map, count)` per lantai dan mengisi `FloorMap.dwellers`.
2. **Prefetch pertanyaan penghuni.** `/api/encounter/questions` dan `/question` menerima `weaknessType: "comprehension"` secara skema, tapi cek: `findingId` kosong, `roomOrder` >= 30 (`DWELLER_ROOM_BASE`), kunci bank `${dweller.id}:0`. Tambahkan tes untuk `generateEncounterQuestions` cabang penghuni (jalur templat saat LLM gagal).
3. **`tooShort`.** `resolveCombat` punya opsi `tooShort` (jawaban < 12 karakter tidak dibalas) tapi answer route belum mengirimnya. Skema `AnswerRequestSchema.answer` masih `min(1)`; samakan dengan aturan BRIEF §13.4.
4. **Weakness Report** harus mengabaikan encounter penghuni (tanpa `finding_id`) sebagai kelemahan; tampilkan terpisah "uji pemahaman: X dari Y". Cek `app/api/run/report` dan `app/report`.
5. Tes live Judge untuk rubrik `claim_explained` (`RUN_LLM_EVAL=1`, lihat `lib/judge/judgeEval.live.test.ts`).

### Tugas A: tampilan bertarung di Phaser
File milik A: `game/entities/**`, `game/scenes/**`, `game/audio.ts`, `game/feel.ts` (baru), `game/PhaserGame.tsx`, `lib/sprites/**`, `app/dev/dungeon/page.tsx`, `public/assets/**`. Aset FX baru sudah mulai disalin (`public/assets/ninja-adventure/fx/arrow.png`, `shield.png`, `items/`); belum ada kode yang memakainya, dan belum ada baris di `public/assets/CREDITS.md`.

- Kenyamanan: getar layar sesuai spec §7 (mutu 1-3 tanpa getar; mutu 4-5 maks 2 px; mati 3 px, boss 4 px; pemain kena 2 px), skala dari `localStorage["sa-shake"]` = `off|soft|full` (default `soft`). Hilangkan kilat layar penuh saat bertarung. Hit-stop maks 50 ms, hanya mutu >= 4, aman bila bertumpuk.
- Animasi per `attackStyle` (`sword` tebas, `bow` proyektil, `shield` dorong, `axe` tebas ganda) memakai field baru di event `boss:hit` (`game/bus.ts`, jangan diubah). Angka damage + label mutu, serangan balik ke pemain, efek tameng.
- Badge "Lv N" di monster (`monsterLevel`), penghuni dirender dari `floorMap.dwellers` dan memicu `encounter:start` dengan `encounterKey: "<dweller.id>:0"`, `findingId: ""`, `bossSlug: "minion-<slug>"`, `room: dweller.roomOrder`, `weaknessType: "comprehension"`. Penghuni tidak menghalangi gerbang boss.
- Peti harta muncul di ruang boss setelah boss kalah (juga saat resume), menyentuhnya memancarkan `treasure:open`. Loot ramuan (`lootKindForKey`) digambar sebagai ramuan; `potion:used` memutar efek sembuh.
- **Bug yang dilaporkan pengguna:** di `/dev/dungeon` ganti karakter tidak mengubah sprite. Cari akar masalahnya (dugaan: `PhaserGame` memakai `if (gameRef.current) return` dan registry diset sekali, jadi game lama tetap hidup saat `key` berganti) dan buktikan di browser untuk kelima karakter.
- `/dev/dungeon`: panel pertanyaan tiruan berlabel jelas "Pratinjau visual", tombol mutu 0-5 yang memakai `resolveCombat`, dua penghuni palsu. Pertanyaan asli hanya ada di alur utama.

### Tugas B: layar, HUD, kontrol
File milik B: `components/**`, `app/**/page.tsx`, `app/layout.tsx`, `app/globals.css`, `tailwind.config.ts`, `lib/useFocusTrap.ts`, `lib/ui/**` (jangan sentuh `app/api`, `app/dev`, `game/**`). Pekerja sebelumnya berhenti sebelum mengubah file apa pun.

- HP di klien: `HeartDisplay` menggambar `hpMax/100` hati yang terisi proporsional plus angka `hp/hpMax`; ubah `GameHud`, `PauseMenu`, `EncounterOverlay`, halaman main.
- Overlay pertarungan: tampilkan rantai jawaban ke damage (lima pip mutu + label, senjata dan lencana "Senjata andalan", satu baris soal bukti naskah, damage, serangan balik atau "Tameng menahan serangan"), baris petunjuk "Jawabanmu = seranganmu" dengan nama senjata dasar/andalan dari `ARSENALS`, "Lv N" dan perlengkapan (`gearForLevel`). Topik `comprehension` berlabel "Uji pemahaman" tanpa lookup rubrik kelemahan. Pecah file 1000 baris itu jadi komponen kecil.
- `findingMeta` di halaman main harus membawa `severity`.
- HUD koin + tombol ramuan (tombol `Q`, POST `/api/run/potion` dengan `requestId: crypto.randomUUID()`), toast untuk loot, modal "Peti Harta" dari `treasure:open` (GET/POST `/api/run/shop`, `purchaseId` UUID, tombol nonaktif saat request jalan, pesan error server apa adanya, `game:pause`/`game:resume`, focus trap, Escape).
- Pengaturan "Guncangan layar" Mati/Halus/Penuh di menu jeda (`sa-shake`).
- Ponsel: layar "Putar perangkatmu" saat potret + layar sentuh (tanpa melepas game atau kehilangan teks jawaban); D-pad kiri bawah dengan tahan-untuk-jalan (`bus.emit("player:step")` tiap ±130 ms, pointer capture), tombol aksi kanan bawah, target >= 44 px, safe-area, `touch-action: none`. Overlay pertarungan di viewport pendek (< 480 px) jadi dua kolom, `100dvh`. HUD harus muat di 667x375.
- Tampilan "lebih dungeon" untuk landing, login, dashboard, upload, map, findings, report, history: bingkai batu, obor, potret (`components/brand/Portrait.tsx`), dashboard sebagai "markas". Jangan hapus fungsi, teks privasi, atau disclaimer dosen pembimbing; hormati `prefers-reduced-motion`; tanpa scroll horizontal dari 360 px.

### Integrasi (terakhir)
Jalankan alur nyata dengan akun uji: unggah, Recon, loadout, bertarung, buka peti, beli ramuan, minum, lantai berikutnya, laporan. Lalu `pnpm typecheck && pnpm test && pnpm build`. Perbarui pointer di `docs/BRIEF.md` (§7, §13.2, §13.5 digantikan spec v2). Belum ada yang dimainkan end-to-end lewat login; semua verifikasi visual sejauh ini lewat `/dev/dungeon`.

## Aturan kerja

- Satu dev server sudah jalan di `localhost:3000` (milik pengguna); jangan dimatikan.
- Browser dipakai bersama: satu pekerja saja yang memegang Playwright pada satu waktu. Simpan tangkapan layar di `.playwright-mcp/` dan hapus sendiri (dua file log lama di folder itu ikut git, jangan dihapus).
- Jangan menulis angka balance di luar `lib/balance.ts`. Klien tidak pernah mengirim HP, damage, mutu, atau koin.
- Batas LLM Kagiro: lihat `LLM_MAX_CONCURRENCY`; 429 beruntun berarti turunkan angkanya.
- Hasil terukur yang perlu dijaga: Recon ±7 dtk, Judge lolos 30/30 uji kalibrasi.
- Future work (target jurnal SINTA/Scopus, dsb.) ada di `docs/FUTURE-WORK.md`, bukan bagian tugas ini.
