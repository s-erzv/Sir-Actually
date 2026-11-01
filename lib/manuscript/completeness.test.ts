import { describe, expect, it } from "vitest";
import { checkCompleteness, parseBibliography } from "./completeness";

const REFERENCES = `
Daftar Pustaka

[1] Anwar, S. (2021). Riset Pendidikan. Bandung: Alfabeta.
[2] Brown, T. (2020). Research Methods. London: Routledge.
[3] Chen, L. (2019). Sampling in Social Science. Jakarta: UI Press.
[4] Davis, M. (2018). Qualitative Inquiry. New York: Sage.
[5] Evans, R. (2017). Statistics for Research. Boston: Pearson.
[6] Fuji, K. (2022). Metode Survei. Yogyakarta: Andi.
[7] Garcia, P. (2020). Mixed Methods. London: Sage.
[8] Hidayat, R. (2021). Analisis Data. Surabaya: Airlangga Press.
[9] Ibrahim, M. (2019). Penelitian Kuantitatif. Jakarta: Prenada.
[10] Jones, A. (2018). Academic Writing. Oxford: OUP.
[11] Kartika, D. (2022). Evaluasi Program. Malang: UB Press.
[12] Lee, S. (2020). Survey Design. New York: Wiley.
`;

const PROPOSAL = `
Pendahuluan
Penelitian ini membahas literasi digital mahasiswa.

Tujuan Penelitian
Mengukur tingkat literasi digital mahasiswa.

Metode
Survei dengan kuesioner.
${REFERENCES}
`;

describe("checkCompleteness", () => {
  it("menolak naskah tanpa daftar pustaka", () => {
    const result = checkCompleteness({
      sourceText: "Pendahuluan\nTujuan\nMetode",
      stage: "proposal",
      minReferences: null,
    });
    expect(result.complete).toBe(false);
    expect(result.missing).toContain("references");
  });

  it("meloloskan proposal tanpa hasil dan kesimpulan", () => {
    const result = checkCompleteness({
      sourceText: PROPOSAL,
      stage: "proposal",
      minReferences: null,
    });
    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("menolak skripsi yang kurang dari min_references pilihan pengguna", () => {
    const result = checkCompleteness({
      sourceText: PROPOSAL,
      stage: "skripsi",
      minReferences: 20,
    });
    expect(result.complete).toBe(false);
    expect(result.missing).toContain("references_min");
    expect(result.missing).toContain("results");
    expect(result.missing).toContain("conclusion");
  });

  it("menerima heading bernomor gaya PDF", () => {
    const text = `
1. Pendahuluan
Penelitian ini membahas tata kelola TI.

2. Tujuan Penelitian
Menentukan prioritas objektif COBIT 2019.

3. Metode Penelitian
Studi kasus dengan wawancara.

4. Hasil dan Pembahasan
Tiga masalah utama ditemukan.

5. Kesimpulan
Prioritas jatuh pada DSS01.

Daftar Pustaka

[1] Anwar, S. (2021). Riset Pendidikan. Bandung: Alfabeta.
`;
    const result = checkCompleteness({
      sourceText: text,
      stage: "jurnal",
      minReferences: null,
    });
    expect(result.missing).toEqual([]);
    expect(result.referenceCount).toBe(1);
  });

  it("memberi peringatan default tanpa memblokir skripsi 12 referensi", () => {
    const text = `${PROPOSAL}\nHasil\nTemuan utama.\n\nKesimpulan\nLiterasi cukup baik.`;
    const result = checkCompleteness({
      sourceText: text,
      stage: "skripsi",
      minReferences: null,
    });
    expect(result.complete).toBe(true);
    expect(result.warnings).toContain("references_below_default");
    expect(result.referenceCount).toBe(12);
  });
});

describe("parseBibliography", () => {
  it("mengenali Daftar Rujukan yang menempel di baris kolom lain", () => {
    const parsed = parseBibliography(
      "komitmen manajemen Daftar Rujukan [1] ISACA, COBIT 2019. 2018. [2] Anwar, S. (2021). Riset Pendidikan. Bandung: Alfabeta.",
    );
    expect(parsed.sectionFound).toBe(true);
    expect(parsed.entries.length).toBe(2);
  });

  it("menghitung entri dengan tahun", () => {
    expect(parseBibliography(REFERENCES).entries).toHaveLength(12);
  });

  it("mengembalikan nol jika heading tidak ada", () => {
    expect(parseBibliography("Tidak ada daftar pustaka.").entries).toHaveLength(0);
  });
});
