/**
 * lib/advice.ts — Kitab Nasihat templates per weakness type (M2).
 *
 * Used when Hearts reach 0. Each entry contains:
 * - problemDescription: why this weakness matters
 * - checklistItems: questions the researcher needs to decide
 *
 * RULES (BRIEF.md §9):
 * - Must refer to the finding and evidence quote (injected at render time)
 * - No fabricated citations or numbers
 * - No rewrite suggestions — only questions/checklist
 * - Disclaimer "bukan pengganti dosen pembimbing" always shown by the UI
 */

import type { WeaknessType } from "@/lib/domain/types";

export interface AdviceTemplate {
  problemDescription: string;
  checklistItems: string[];
}

export const ADVICE_TEMPLATES: Record<WeaknessType, AdviceTemplate> = {
  // ── Gap Hunter ────────────────────────────────────────────────────────────
  gap_unsupported: {
    problemDescription:
      "Gap penelitian diklaim ada, tetapi tidak didukung oleh referensi yang menunjukkan bahwa gap itu nyata dan belum dijawab.",
    checklistItems: [
      "Apakah kamu bisa menemukan minimal satu studi yang menyebutkan bahwa permasalahan ini belum diteliti?",
      "Apakah referensi yang ada di daftar pustakamu membahas topik yang sama tetapi dengan konteks atau metode berbeda?",
      "Apakah gap yang kamu klaim masuk ke dalam bagian latar belakang dengan hubungan yang jelas ke tujuan penelitian?",
    ],
  },
  gap_answered_by_own_refs: {
    problemDescription:
      "Gap yang diklaim ternyata sudah dijawab oleh referensi yang kamu kutip sendiri di bagian lain naskah.",
    checklistItems: [
      "Apakah referensi yang kamu kutip benar-benar tidak menjawab pertanyaan penelitianmu?",
      "Apakah ada perbedaan konteks, populasi, atau metode yang membuat gapmu tetap valid meski topiknya mirip?",
      "Apakah kamu perlu merumuskan ulang gap agar lebih spesifik dan tidak tumpang-tindih dengan studi yang sudah ada?",
    ],
  },
  claim_without_citation: {
    problemDescription:
      "Ada klaim faktual atau statistik yang dibuat tanpa menyertakan sumber referensi.",
    checklistItems: [
      "Apakah klaim ini berasal dari studi tertentu? Kalau ya, apakah referensinya sudah ada di daftar pustakamu?",
      "Apakah klaim ini bisa diverifikasi atau apakah ini asumsimu sendiri?",
      "Apakah kamu bisa menambahkan sitasi atau mengubah klaim menjadi pernyataan yang tidak membutuhkan bukti eksternal?",
    ],
  },

  // ── Aligner ───────────────────────────────────────────────────────────────
  problem_objective_gap: {
    problemDescription:
      "Masalah penelitian yang dirumuskan tidak terhubung secara logis ke tujuan penelitian.",
    checklistItems: [
      "Apakah setiap tujuan penelitian secara langsung menjawab masalah yang dirumuskan?",
      "Apakah ada tujuan yang muncul tanpa ada masalah yang mendasarinya?",
      "Apakah masalah yang dirumuskan cukup spesifik untuk menghasilkan tujuan yang dapat dicapai?",
    ],
  },
  objective_rq_mismatch: {
    problemDescription:
      "Rumusan masalah (RQ) tidak sejajar dengan tujuan penelitian yang dinyatakan.",
    checklistItems: [
      "Apakah setiap RQ muncul langsung dari tujuan yang bersesuaian?",
      "Apakah ada RQ yang lebih luas atau lebih sempit dari tujuannya?",
      "Apakah semua tujuan memiliki RQ yang menjawabnya?",
    ],
  },

  // ── Methodologist ─────────────────────────────────────────────────────────
  rq_method_mismatch: {
    problemDescription:
      "Metode yang dipilih tidak sesuai untuk menjawab rumusan masalah yang diajukan.",
    checklistItems: [
      "Apakah jenis data yang dihasilkan metode ini (kuantitatif/kualitatif) sesuai dengan pertanyaan penelitianmu?",
      "Apakah ada metode lain yang lebih tepat untuk RQ-mu, dan mengapa kamu memilih metode yang ada?",
      "Apakah keterbatasan metode yang dipilih diakui dalam naskah?",
    ],
  },
  sample_unreported: {
    problemDescription:
      "Ukuran sampel tidak dilaporkan atau tidak dibenarkan secara metodologis.",
    checklistItems: [
      "Berapa jumlah responden/partisipan dalam penelitianmu? Apakah angka ini sudah ada di bagian metode?",
      "Apa alasan pemilihan ukuran sampel ini (misalnya: total populasi, rumus Slovin, saturasi data)?",
      "Apakah ukuran sampel ini cukup untuk jenis analisis yang digunakan (korelasi, regresi, uji-t, dsb.)?",
    ],
  },
  generalization_beyond_sample: {
    problemDescription:
      "Temuan digeneralisasikan ke populasi yang lebih luas dari sampel yang diteliti.",
    checklistItems: [
      "Apakah kesimpulan hanya berlaku untuk konteks dan populasi yang benar-benar diteliti?",
      "Apakah kamu menggunakan bahasa kausal ('menyebabkan', 'berpengaruh') padahal desainmu korelasional?",
      "Apakah keterbatasan generalisasi ini sudah disebutkan di bagian keterbatasan penelitian?",
    ],
  },
  limitation_missing: {
    problemDescription:
      "Penelitian tidak memiliki bagian keterbatasan yang memadai.",
    checklistItems: [
      "Apakah ada keterbatasan sampel (ukuran, cara pemilihan, representativitas)?",
      "Apakah ada keterbatasan metode atau instrumen pengukuran yang perlu diakui?",
      "Apakah keterbatasan yang ada memengaruhi validitas atau reliabilitas temuan?",
    ],
  },

  // ── Auditor ───────────────────────────────────────────────────────────────
  conclusion_overclaim: {
    problemDescription:
      "Kesimpulan melampaui apa yang bisa disimpulkan dari data atau metode yang digunakan.",
    checklistItems: [
      "Apakah setiap kalimat di kesimpulan didukung langsung oleh temuan di bab hasil?",
      "Apakah ada klaim kausal padahal desain penelitiannya hanya korelasional?",
      "Apakah angka dan statistik di kesimpulan sama persis dengan yang ada di bab hasil?",
    ],
  },
  objective_without_finding: {
    problemDescription:
      "Ada tujuan penelitian yang tidak memiliki temuan yang menjawabnya.",
    checklistItems: [
      "Untuk setiap tujuan, dapatkah kamu menunjuk ke bagian bab hasil yang menjawabnya secara langsung?",
      "Apakah ada tujuan yang terlalu luas untuk dicapai dengan data yang dikumpulkan?",
      "Apakah semua tujuan benar-benar direfleksikan di bagian kesimpulan?",
    ],
  },
  abstract_result_mismatch: {
    problemDescription:
      "Hasil yang dilaporkan di abstrak berbeda dengan yang ada di bab hasil.",
    checklistItems: [
      "Apakah setiap angka di abstrak sama persis dengan yang ada di bab hasil?",
      "Apakah ada temuan di bab hasil yang tidak disebutkan di abstrak, atau sebaliknya?",
      "Apakah abstrak menggambarkan temuan secara akurat tanpa melebih-lebihkan?",
    ],
  },

  // ── References ────────────────────────────────────────────────────────────
  citation_not_found: {
    problemDescription:
      "Referensi yang dikutip tidak dapat ditemukan di database akademik yang dapat diverifikasi.",
    checklistItems: [
      "Apakah detail bibliografi (nama penulis, tahun, judul, jurnal/penerbit) sudah lengkap dan akurat?",
      "Apakah referensi ini benar-benar pernah diterbitkan, atau mungkin ada kesalahan penulisan judul/nama?",
      "Apakah referensi ini bisa diganti dengan sumber yang bisa diverifikasi secara online?",
    ],
  },
  citation_claim_mismatch: {
    problemDescription:
      "Referensi yang dikutip tidak mendukung klaim yang dilampirkan padanya.",
    checklistItems: [
      "Apakah kamu benar-benar membaca referensi ini, dan apakah isinya mendukung klaimmu?",
      "Apakah ada referensi lain yang lebih tepat untuk mendukung klaim ini?",
      "Apakah klaim yang kamu buat merupakan interpretasimu sendiri terhadap referensi tersebut?",
    ],
  },
};
