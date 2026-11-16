import { describe, expect, it } from "vitest";
import { chunkManuscript } from "@/lib/manuscript/chunk";
import { sliceForDimensions } from "./slices";

const SOURCE = `# Pendahuluan
Belum ada penelitian yang membahas media sosial dan prestasi di kampus kecil.

# Metode
Sampel berjumlah 45 mahasiswa yang dipilih secara purposive dari satu angkatan.

# Hasil
Korelasi antara kedua variabel adalah r = -0,41.

# Kesimpulan
Media sosial menyebabkan turunnya prestasi mahasiswa di Indonesia.

# Daftar Pustaka
Sari, A. (2020). Media sosial. Jurnal Pendidikan.`;

describe("sliceForDimensions", () => {
  const chunks = chunkManuscript(SOURCE);
  const slices = sliceForDimensions(chunks, [
    { kind: "method", sourceQuote: "Sampel berjumlah 45 mahasiswa" },
    { kind: "conclusion", sourceQuote: "Media sosial menyebabkan turunnya prestasi" },
  ]);

  it("memberi tiap spesialis bagian naskahnya sendiri", () => {
    expect(slices.method.map((chunk) => chunk.sectionLabel)).toContain("Metode");
    expect(slices.audit.map((chunk) => chunk.sectionLabel)).toEqual(
      expect.arrayContaining(["Hasil", "Kesimpulan"]),
    );
    expect(slices.gap.map((chunk) => chunk.sectionLabel)).toContain("Pendahuluan");
  });

  it("tidak pernah mengirim daftar pustaka sebagai isi naskah", () => {
    for (const slice of Object.values(slices)) {
      expect(slice.some((chunk) => chunk.sectionLabel === "Daftar Pustaka")).toBe(false);
    }
  });

  it("tetap memberi potongan untuk naskah tanpa heading", () => {
    const plain = chunkManuscript("Paragraf satu tentang riset.\n\nParagraf dua tentang hasil.");
    expect(sliceForDimensions(plain, []).method.length).toBeGreaterThan(0);
  });

  it("menghormati batas ukuran", () => {
    const tight = sliceForDimensions(chunks, [], 80);
    expect(tight.audit.reduce((sum, chunk) => sum + chunk.text.length, 0)).toBeLessThanOrEqual(80);
  });
});
