/**
 * lib/rubrics.ts — static rubric lookup by weakness type (M2).
 *
 * Each weakness type has exactly 3 criteria → scoreMax = 6.
 * In M3+ these will be fetched from the `rubrics` DB table.
 *
 * Criterion ids match what rules.ts references (sample_justified, no_overclaim, etc.).
 */

import type { RubricCriterion, WeaknessType } from "@/lib/domain/types";

export const RUBRICS: Record<WeaknessType, RubricCriterion[]> = {
  // ── Gap Hunter ────────────────────────────────────────────────────────────
  gap_unsupported: [
    { id: "gap_identified",  label: "Gap disebutkan dengan jelas" },
    { id: "gap_supported",   label: "Gap didukung minimal 1 referensi dari daftar pustaka" },
    { id: "gap_relevant",    label: "Gap relevan dengan tujuan penelitian" },
  ],
  gap_answered_by_own_refs: [
    { id: "gap_genuine",     label: "Gap tidak terjawab oleh referensi yang dikutip sendiri" },
    { id: "gap_supported",   label: "Argumen gap didukung referensi eksternal yang tepat" },
    { id: "gap_relevant",    label: "Gap relevan dengan tujuan penelitian" },
  ],
  claim_without_citation: [
    { id: "claim_cited",     label: "Klaim disertai minimal 1 sitasi" },
    { id: "gap_supported",   label: "Sitasi ada di daftar pustaka naskah" },
    { id: "numbers_consistent", label: "Angka/statistik dalam klaim konsisten dengan sumber" },
  ],

  // ── Aligner ───────────────────────────────────────────────────────────────
  problem_objective_gap: [
    { id: "link_explicit",   label: "Hubungan masalah–tujuan dijelaskan secara eksplisit" },
    { id: "link_logical",    label: "Hubungan masalah–tujuan logis dan koheren" },
    { id: "no_overclaim",    label: "Tujuan tidak melampaui cakupan masalah" },
  ],
  objective_rq_mismatch: [
    { id: "link_explicit",   label: "Setiap RQ terhubung ke tujuan yang bersesuaian" },
    { id: "link_logical",    label: "Hubungan tujuan–RQ logis" },
    { id: "no_overclaim",    label: "RQ tidak melampaui tujuan" },
  ],

  // ── Methodologist ─────────────────────────────────────────────────────────
  rq_method_mismatch: [
    { id: "method_appropriate", label: "Metode yang dipilih sesuai dengan RQ" },
    { id: "method_justified",   label: "Pilihan metode dibenarkan dengan alasan" },
    { id: "no_overclaim",       label: "Klaim kemampuan metode tidak berlebihan" },
  ],
  sample_unreported: [
    { id: "sample_size_stated",  label: "Ukuran sampel (n) disebutkan" },
    { id: "sample_justified",    label: "Kecukupan sampel dibenarkan dengan alasan/angka" },
    { id: "sample_selection",    label: "Cara pemilihan sampel dijelaskan" },
  ],
  generalization_beyond_sample: [
    { id: "scope_accurate",    label: "Generalisasi dibatasi sesuai sampel" },
    { id: "no_overclaim",      label: "Tidak ada klaim kausal dari desain korelasional" },
    { id: "numbers_consistent","label": "Angka dalam klaim konsisten dengan data sampel" },
  ],
  limitation_missing: [
    { id: "limitation_stated", label: "Keterbatasan penelitian disebutkan" },
    { id: "limitation_honest", label: "Keterbatasan jujur dan spesifik, bukan boilerplate" },
    { id: "limitation_impact", label: "Dampak keterbatasan terhadap temuan diakui" },
  ],

  // ── Auditor ───────────────────────────────────────────────────────────────
  conclusion_overclaim: [
    { id: "no_overclaim",        label: "Kesimpulan tidak melampaui temuan" },
    { id: "numbers_consistent",  label: "Angka/statistik di kesimpulan konsisten dengan hasil" },
    { id: "scope_accurate",      label: "Cakupan generalisasi sesuai data" },
  ],
  objective_without_finding: [
    { id: "finding_present",     label: "Setiap tujuan memiliki temuan yang bersesuaian" },
    { id: "finding_explicit",    label: "Temuan disebutkan secara eksplisit untuk tujuan ini" },
    { id: "link_logical",        label: "Hubungan tujuan–temuan logis" },
  ],
  abstract_result_mismatch: [
    { id: "abstract_accurate",   label: "Hasil di abstrak sama dengan di bab hasil" },
    { id: "numbers_consistent",  label: "Angka/statistik di abstrak konsisten dengan isi" },
    { id: "no_overclaim",        label: "Abstrak tidak melebih-lebihkan temuan" },
  ],

  // ── References (Ghost — no Heart cost, no battle rubric needed in M2) ─────
  citation_not_found: [
    { id: "ref_exists",          label: "Referensi dapat ditemukan di database akademik" },
    { id: "ref_accessible",      label: "Detail referensi cukup untuk diverifikasi" },
    { id: "ref_relevant",        label: "Referensi relevan dengan klaim yang dikutip" },
  ],
  citation_claim_mismatch: [
    { id: "ref_supports_claim",  label: "Referensi mendukung klaim yang ditautkan" },
    { id: "ref_quoted_accurately","label": "Isi referensi dikutip secara akurat" },
    { id: "ref_exists",          label: "Referensi dapat diverifikasi" },
  ],
};

/** Returns criterion ids for a given weakness type. */
export function getCriterionIds(weaknessType: WeaknessType): string[] {
  return RUBRICS[weaknessType].map((c) => c.id);
}

/** Returns scoreMax (= criteria count × 2) for a weakness type. */
export function getScoreMax(weaknessType: WeaknessType): number {
  return RUBRICS[weaknessType].length * 2;
}
