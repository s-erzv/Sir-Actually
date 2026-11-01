export const WEAKNESS_LABELS: Record<string, string> = {
  gap_unsupported: "Gap tanpa dukungan",
  gap_answered_by_own_refs: "Gap sudah dijawab referensi sendiri",
  claim_without_citation: "Klaim tanpa sitasi",
  problem_objective_gap: "Masalah–tujuan tidak tersambung",
  objective_rq_mismatch: "Tujuan–RQ tidak selaras",
  rq_method_mismatch: "RQ–metode tidak cocok",
  sample_unreported: "Ukuran sampel tidak dilaporkan",
  generalization_beyond_sample: "Generalisasi melampaui sampel",
  limitation_missing: "Keterbatasan tidak disebut",
  conclusion_overclaim: "Kesimpulan berlebihan",
  objective_without_finding: "Tujuan tanpa temuan",
  abstract_result_mismatch: "Abstrak tidak cocok dengan hasil",
  citation_not_found: "Referensi tidak ditemukan",
  citation_claim_mismatch: "Referensi tidak mendukung klaim",
};

export const CLAIM_LABELS: Record<string, string> = {
  problem: "Masalah",
  gap: "Gap",
  objective: "Tujuan",
  rq: "Pertanyaan penelitian",
  method: "Metode",
  finding: "Temuan",
  limitation: "Keterbatasan",
  conclusion: "Kesimpulan",
};

export const STAGE_LABELS: Record<string, string> = {
  proposal: "Proposal",
  skripsi: "Skripsi",
  jurnal: "Artikel jurnal",
};

export const STATUS_LABELS: Record<string, string> = {
  unchecked: "Belum dicek",
  verified: "Terverifikasi",
  not_found: "Tidak ditemukan",
  mismatch: "Tidak cocok",
  needs_review: "Perlu tinjauan",
};
