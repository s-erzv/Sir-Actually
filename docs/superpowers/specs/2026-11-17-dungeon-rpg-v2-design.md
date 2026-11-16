# Dungeon RPG v2 — desain

Tanggal: 17 Nov 2026. Sumber: permintaan Maou (sesi 16–17 Nov). Dokumen ini
**menggantikan** BRIEF §7 (rumus damage, Heart), §13.2 (senjata), dan sebagian
§13.5 (poin) di tempat yang disebut di bawah. Prinsip BRIEF §1 tetap berlaku:
grounded, checkable, rubric-first, pemain tetap penulis.

## Tujuan

Bermain harus terasa seperti game dungeon sungguhan (HP, senjata, level
monster, harta, ramuan) **tanpa** melepas intinya: setiap serangan adalah
jawaban atas pertanyaan tentang naskah pemain, dan kekuatan serangan
ditentukan oleh mutu jawaban itu.

Bukan tujuan: PvP, toko dengan uang sungguhan, monster yang mengarang
kelemahan naskah, timer.

Anti-tujuan: pertarungan yang bisa dimenangkan tanpa menjawab; getaran layar
yang bikin pusing; temuan palsu masuk Weakness Report.

## Pendekatan yang dipertimbangkan

1. **Tempel kosmetik saja** (animasi + UI, aturan lama). Murah, tapi keluhan
   "kurang game" menyangkut aturan (HP, senjata, harta), bukan hanya tampilan.
2. **Mesin RPG baru terpisah dari Judge** (level, stat, skill tree). Paling
   "game", tapi damage jadi tidak terikat mutu jawaban dan butuh skema DB baru.
3. **Dipilih: lapisan RPG tipis di atas Judge.** Judge tetap memberi level
   0/1/2 per kriteria; kode mengubahnya jadi Mutu 0–5, lalu Mutu × daya
   senjata = damage. Tanpa migrasi DB. Semua angka di `lib/balance.ts`.

## 1. Mutu jawaban (0–5), dihitung kode

`rasio = scoreTotal / scoreMax` (setelah validator kutipan dan rules).

| Kondisi | Mutu dasar |
|---|---|
| verdict off_topic / nonsense, atau rasio 0 | 0 |
| 0 < rasio < 0,5 | 1 |
| 0,5 ≤ rasio < 0,75 | 2 |
| 0,75 ≤ rasio < 1 | 3 |
| rasio = 1 | 4 |

**+1 (maks 5)** jika Mutu dasar ≥ 2 **dan** jawaban memakai bukti naskah:
mengutip ≥ 6 kata persis dari naskah, atau menyebut angka yang ada di naskah,
atau menyebut penulis/tahun dari daftar pustaka. Pengecekan permukaan oleh
kode (fungsi yang sudah ada di `lib/loadout.ts`); tidak mengubah level kriteria.

Label: 0 Meleset · 1 Goresan · 2 Lemah · 3 Kena · 4 Telak · 5 Kritis.
Pengali damage (sengaja pelit): `[0, 0.15, 0.35, 0.55, 0.8, 1.0]`.

AI tidak pernah memberi angka damage. Jawaban singkat tanpa alasan paling
tinggi Mutu 2–3; Kritis hanya untuk nilai penuh + bukti naskah.

## 2. Senjata

Pemain tidak memilih senjata per serangan. Tiap karakter membawa dua:

- **Senjata dasar**: selalu bisa dipakai. Daya 30.
- **Senjata andalan**: hanya keluar jika syaratnya terpenuhi oleh jawaban
  (syarat lama tiap senjata). Daya 44.

Server memilih andalan bila syaratnya terpenuhi, selain itu dasar.
`damage = round(daya × pengali[Mutu])`, lalu pasif karakter (maks +3).
Pemetaan: senjata pertama tiap karakter di `CHARACTERS[].weaponSlugs` = andalan,
kedua = dasar, kecuali Sena: Perisai Batas (dasar, efek tameng) dan Lentera
Kubur (andalan). `weaponBonus` 0,95–1,10 lama dihapus.

Gaya serang untuk animasi: Arka `sword`, Mira `bow`, Sena `shield`,
Kiran `bow`, Vara `axe`.

## 3. Level dan HP monster

`level = clamp(floorOrder + severity − 2, 1, 6)`; boss `clamp(floorOrder + 1, 2, 6)`;
penghuni (lihat §5) `clamp(floorOrder, 1, 6)`.

| Jenis | HP | Serangan (ATK) | Maks pertanyaan |
|---|---|---|---|
| Antek | 45 + 8·(L−1) | 30 + 8·(L−1) | 2 (L ≥ 3: 3) |
| Boss | 110 + 15·(L−1) | 60 + 10·(L−1), maks 100 | 4 (L ≥ 4: 5) |
| Penghuni | 22 + 4·(L−1) | 20 + 5·(L−1) | 1 |

Perlengkapan per level (nama + ikon): 1 Pentung, 2 Belati, 3 Pedang, 4 Kapak,
5 Zirah, 6 Mahkota. Ditampilkan "Varkul · Lv 3 · Pedang".

Cek pacing: antek L1 (HP 45) mati oleh dua jawaban Telak dengan senjata dasar
(24 + 24). Boss L2 (HP 125) butuh empat Telak dengan andalan (35 × 4 = 140).

## 4. Heart berisi HP

1 Heart = 100 HP. HP maks = jumlah Heart karakter × 100. `runs.hearts_left`
sekarang menyimpan **HP total** (kolom yang sama, tanpa migrasi; layout version
dinaikkan supaya run lama ditutup). Respons API tetap punya `hearts` =
`ceil(hp / 100)` dan menambah `hp`, `hpMax`.

Monster membalas berdasarkan Mutu:

| Mutu | Serangan balik |
|---|---|
| 0 | ATK penuh |
| 1 | 40% ATK |
| ≥ 2 | tidak ada |

Jawaban terlalu pendek (< 12 karakter) tetap tidak dihukum. Tameng Sena
membatalkan satu serangan balik per lantai. HP 0 = encounter `lost` (Epitaf).

## 5. Penghuni dungeon (monster pengisi)

Supaya lantai tidak sepi, tiap lantai penelitian diisi sampai
`target = min(3 + floorOrder, 7)` monster. Kekurangannya diisi **penghuni**.

- Penghuni **bukan temuan** dan tidak pernah masuk Weakness Report sebagai
  kelemahan. Ia menguji **pemahaman**: satu pertanyaan tentang satu klaim
  Research Map dari dimensi lantai itu ("Jelaskan dengan kata-katamu sendiri…").
  Tetap grounded: klaim dan kutipannya berasal dari naskah.
- Jumlah, level, dan posisi ditentukan kode (deterministik per seed). AI hanya
  menulis kalimat pertanyaan. Kalau klaim yang cocok habis, jumlah penghuni
  berkurang; tidak ada pertanyaan karangan.
- Berdiri di persimpangan lorong. Tidak wajib untuk membuka gerbang boss.
- Rubrik satu kriteria: `claim_explained` — "Menjelaskan klaim dengan kata
  sendiri dan sesuai naskah". Tipe internal `comprehension`.
- Menang: 10 poin. Laporan mencatat "uji pemahaman: X dari Y".

## 6. Harta, poin, ramuan

- **Poin = koin.** Dompet run = `points_total` (jumlah semua event, termasuk
  belanja bernilai negatif). **Rank** dihitung dari poin kotor (jumlah event
  positif), jadi belanja tidak menurunkan rank.
- **Peti Harta** muncul di ruang boss setelah boss kalah. Menyentuhnya membuka
  toko:
  - Ramuan Kecil (+40 HP): 25 poin
  - Ramuan Besar (+100 HP): 55 poin
  Ramuan masuk tas (maks 3), dipakai kapan saja di luar pertarungan.
- **Jarahan** di lantai: 1 dari 5 titik (dari hash kunci, deterministik) berisi
  Ramuan Kecil, sisanya poin 1–5 seperti sekarang. Jalan buntu: 1 dari 3.
- Semua lewat `run_points_events` (idempoten): `shop` (negatif), `potion_gain`
  dan `potion_use` (0 poin). Isi tas = gain − use.

## 7. Rasa bertarung

Mengikuti tier skill `game-feel`. Layar hanya bergetar untuk pukulan besar.

| Kejadian | Getar kamera | Lainnya |
|---|---|---|
| Mutu 1–3 | tidak ada | kilat putih pada monster, dorongan 3 px, angka |
| Mutu 4–5 | kecil (maks 2 px, 120 ms) | + efek tebasan, hit-stop 50 ms |
| Monster mati | sedang (maks 3 px, 200 ms; boss 4 px) | ledakan partikel |
| Pemain kena | kecil (2 px) | kilat merah pada pemain saja |

Tanpa kilat layar penuh. Pengaturan "Guncangan layar" (Mati / Halus / Penuh,
default Halus) di menu jeda, disimpan di localStorage. Animasi serang mengikuti
gaya senjata: `sword` tebas, `bow` proyektil terbang, `shield` dorong, `axe`
tebas ganda.

## 8. Layar dan kontrol

- HP di ponsel wajib lanskap saat bermain; potret menampilkan layar "putar
  perangkat". D-pad kiri bawah (tahan = jalan terus), tombol aksi kanan bawah
  (ramuan, jeda), menghormati safe-area.
- Overlay pertarungan di lanskap pendek: dua kolom (monster + pertanyaan |
  jawaban), `100dvh`, bisa digulir.
- Semua halaman memakai bingkai batu, obor, dan potret karakter/monster.

## 9. Kontrak antar bagian

```ts
// lib/domain/types.ts
type AttackStyle = "sword" | "bow" | "shield" | "axe";
interface CombatOutcome {
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  qualityLabel: string;
  usedEvidence: boolean;
  weaponSlug: string;
  weaponName: string;
  weaponKind: "basic" | "signature";
  attackStyle: AttackStyle;
  damage: number;          // ke monster
  counterDamage: number;   // ke pemain
  shielded: boolean;
}
// Respons /api/encounter/answer menambah:
//   combat: CombatOutcome; hp: number; hpMax: number; monsterLevel: number
// (newHearts = ceil(hp / 100) tetap ada)

// game/bus.ts
"boss:hit": { encounterId; damage; quality; attackStyle; counterDamage; heartLost? }
"player:hp": { hp: number; hpMax: number }
"treasure:open": { floor: number }          // Phaser → React
"potion:picked": { key: string }            // Phaser → React

// API baru
GET  /api/run/shop?runId          → { coins, potions, hp, hpMax, items[] }
POST /api/run/shop { runId, item: "potion_small" | "potion_large" }
POST /api/run/potion { runId }    → { hp, hpMax, potions }
```

## Diserahkan ke pembangun

Tata letak persis toko dan HUD, pilihan sprite ikon perlengkapan, bentuk
proyektil, teks label kecil.
