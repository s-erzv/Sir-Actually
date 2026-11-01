import { describe, expect, it } from "vitest";
import { detectCodeFindings } from "./codeDetectors";

const SOURCE = `
Penelitian menunjukkan peningkatan signifikan tanpa sitasi.
Kesenjangan penelitian ini belum dijawab oleh studi lain.
Metode yang digunakan adalah survei.
Hasil menunjukkan skor naik.
Kesimpulan: program berhasil.
`;

describe("detectCodeFindings", () => {
  it("menemukan gap tanpa sitasi, klaim signifikan tanpa sitasi, dan sampel tidak dilaporkan", () => {
    const findings = detectCodeFindings(
      [
        {
          id: "c1",
          kind: "gap",
          text: "Kesenjangan penelitian ini belum dijawab oleh studi lain.",
          sourceQuote: "Kesenjangan penelitian ini belum dijawab oleh studi lain.",
        },
        {
          id: "c2",
          kind: "finding",
          text: "Penelitian menunjukkan peningkatan signifikan.",
          sourceQuote: "Penelitian menunjukkan peningkatan signifikan tanpa sitasi.",
        },
        {
          id: "c3",
          kind: "method",
          text: "Metode yang digunakan adalah survei.",
          sourceQuote: "Metode yang digunakan adalah survei.",
        },
      ],
      "skripsi",
      SOURCE,
    );
    const types = findings.map((finding) => finding.weaknessType);
    expect(types).toContain("gap_unsupported");
    expect(types).toContain("claim_without_citation");
    expect(types).toContain("sample_unreported");
    expect(types).toContain("limitation_missing");
  });

  it("membuang temuan yang kutipannya tidak ada di naskah", () => {
    const findings = detectCodeFindings(
      [
        {
          id: "c1",
          kind: "gap",
          text: "Gap palsu",
          sourceQuote: "Kalimat yang tidak ada.",
        },
      ],
      "proposal",
      SOURCE,
    );
    expect(findings).toHaveLength(0);
  });

  it("menandai tujuan tanpa temuan pada skripsi", () => {
    const findings = detectCodeFindings(
      [
        {
          id: "c1",
          kind: "objective",
          text: "Mengukur dampak program.",
          sourceQuote: "Kesimpulan: program berhasil.",
        },
        {
          id: "c2",
          kind: "limitation",
          text: "Keterbatasan: sampel kecil.",
          sourceQuote: "Kesimpulan: program berhasil.",
        },
      ],
      "skripsi",
      SOURCE,
    );
    expect(findings.map((finding) => finding.weaknessType)).toContain(
      "objective_without_finding",
    );
  });
});
