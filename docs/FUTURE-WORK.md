# Future work

Hal yang sengaja belum dikerjakan di MVP. Urut dari yang paling berdampak.

## 1. Target publikasi sebagai parameter analisis

Sekarang semua naskah diuji dengan rubrik yang sama. Padahal tuntutan jurnal
berbeda jauh, jadi "kelemahan" seharusnya relatif terhadap tujuan pemain.

**Masukan baru di layar unggah**

- Jenis target: skripsi/tesis, prosiding, jurnal nasional, jurnal internasional.
- Jurnal nasional: terakreditasi SINTA atau tidak; jika ya, peringkat 1–6.
- Jurnal internasional: terindeks Scopus / Web of Science atau tidak; jika ya,
  kuartil Q1–Q4 (opsional).
- Opsional: nama jurnal dan tautan author guidelines-nya.

**Yang berubah di analisis**

- `manuscripts.target` (jsonb) dibaca oleh Recon, Questioner, dan Judge.
- Tiap target punya **profil tuntutan**: kriteria tambahan dan ambang yang
  lebih ketat. Contoh arah (belum angka final):
  - makin tinggi target, makin dituntut kebaruan yang dinyatakan eksplisit dan
    diposisikan terhadap literatur mutakhir;
  - kedalaman metode: justifikasi sampel, validitas/reliabilitas instrumen,
    analisis yang sepadan dengan klaim;
  - proporsi rujukan primer dan kemutakhiran rujukan;
  - kelengkapan: keterbatasan, implikasi, pernyataan etik bila relevan.
- Severity temuan disesuaikan: masalah yang sama bisa severity 1 untuk target
  rendah dan severity 3 untuk target tinggi.
- Level monster dan tier dungeon mengikuti target: target lebih tinggi =
  dungeon lebih dalam.
- Weakness Report menutup dengan "jarak ke target": kriteria mana yang sudah
  dan belum terpenuhi untuk target yang dipilih, plus saran target yang lebih
  realistis kalau jaraknya jauh.

**Syarat sebelum dibangun**

- Profil tuntutan **tidak boleh dikarang**. Sumbernya harus dokumen resmi:
  instrumen akreditasi jurnal nasional (ARJUNA/SINTA), author guidelines
  jurnal yang dituju, dan kriteria seleksi pengindeks. Setiap kriteria di
  profil menyimpan sumber dan tanggal aksesnya.
- Angka apa pun (jumlah rujukan minimal, proporsi rujukan primer, dsb.) diberi
  label sumber; tanpa sumber, tampil sebagai saran, bukan gerbang.
- Uji dulu dengan naskah yang sudah terbit di tiap peringkat, supaya profil
  tidak menolak naskah yang nyatanya diterima.

## 2. Guideline jurnal spesifik

Pemain menempel tautan atau PDF author guidelines; sistem mengekstrak syarat
(struktur, panjang, gaya sitasi, batas kata abstrak) menjadi cek kode. Ini
gerbang format, bukan monster.

## 3. Kalibrasi

- Severity dan Mutu jawaban dikalibrasi dari data bermain dan `pilot_feedback`.
- Set uji Judge diperluas per dimensi dan per bahasa (Indonesia / Inggris).
- Angka balance (HP, ATK, harga ramuan) ditala dari tingkat menang per lantai.

## 4. Kedalaman game

- Senjata dan perlengkapan yang bisa ditemukan dan dipasang.
- Skill aktif per karakter dengan cooldown.
- Varian monster elit, jebakan, kunci dan pintu rahasia.
- Papan peringkat per kampus/prodi (opt-in, tanpa isi naskah).
- Mode latihan sidang berwaktu.

## 5. Kolaborasi dan pembimbing

- Bagikan Weakness Report ke dosen pembimbing lewat tautan baca-saja.
- Dosen memberi catatan pada temuan; catatan itu jadi monster di run berikutnya.
- Perbandingan antar revisi yang lebih kaya dari tiga status sekarang.

## 6. Teknis

- Recon sebagai job antrean di server, bukan digerakkan dari browser.
- Streaming jawaban Judge supaya terasa instan.
- Embedding lokal dan evaluasi retrieval per naskah.
- PDF hasil scan (OCR).
- Aplikasi terpasang (PWA) dan mode luring untuk menjelajah.
- Observabilitas: biaya dan latensi LLM per rute, alarm saat 429 beruntun.
