import { describe, expect, it } from "vitest";
import { htmlToMarkdown, pdfItemsToText, plainTextToMarkdown } from "./extract";

describe("htmlToMarkdown", () => {
  it("keeps headings and paragraphs, strips inline emphasis", () => {
    const md = htmlToMarkdown("<h2>Metode</h2><p>Sampel <strong>5</strong> orang.</p>");
    expect(md).toContain("## Metode");
    expect(md).toContain("Sampel 5 orang.");
    expect(md).not.toContain("**");
  });

  it("removes scripts and images", () => {
    const md = htmlToMarkdown('<p>Halo</p><script>alert(1)</script><img src="x.png">');
    expect(md).toBe("Halo");
  });
});

describe("pdfItemsToText", () => {
  it("rebuilds lines from baselines even when hasEOL is missing", () => {
    const text = pdfItemsToText([
      { str: "1. Pendahuluan", width: 80, transform: [1, 0, 0, 1, 40, 700] },
      { str: "Usaha kecil", width: 60, transform: [1, 0, 0, 1, 40, 680] },
      { str: "memakai sistem", width: 70, transform: [1, 0, 0, 1, 104, 680] },
      { str: "2. Metode", width: 50, transform: [1, 0, 0, 1, 40, 660] },
    ]);
    expect(text.split("\n")).toEqual([
      "1. Pendahuluan",
      "Usaha kecil memakai sistem",
      "2. Metode",
    ]);
  });
});

describe("plainTextToMarkdown", () => {
  it("turns known headings into markdown and joins paragraphs", () => {
    const md = plainTextToMarkdown("PENDAHULUAN\nIni kalimat satu.\nIni kalimat dua.\n\nMETODE\nSampel 5 orang.");
    expect(md).toContain("## PENDAHULUAN");
    expect(md).toContain("Ini kalimat satu. Ini kalimat dua.");
    expect(md).toContain("## METODE");
  });

  it("recognises numbered headings from PDF text", () => {
    const md = plainTextToMarkdown(
      "1. Pendahuluan\nLatar masalah.\n\n2. Metode Penelitian\nStudi kasus.\n\n3. Hasil dan Pembahasan\nTemuan.\n\n4. Kesimpulan\nSaran.",
    );
    expect(md).toContain("## 1. Pendahuluan");
    expect(md).toContain("## 2. Metode Penelitian");
    expect(md).toContain("## 3. Hasil dan Pembahasan");
    expect(md).toContain("## 4. Kesimpulan");
  });

  it("strips zero-width spaces used by PDF heading numbers", () => {
    const md = plainTextToMarkdown(
      "1. \u200B Pendahuluan\nLatar masalah.\n\n2. \u200B Metode Penelitian\nStudi kasus.\n\n4. \u200B Kesimpulan\nSaran.",
    );
    expect(md).toContain("## 1. Pendahuluan");
    expect(md).toContain("## 2. Metode Penelitian");
    expect(md).toContain("## 4. Kesimpulan");
  });

  it("splits numbered headings collapsed into one long paragraph", () => {
    const collapsed =
      "Abstrak Penelitian ini membahas tata kelola teknologi informasi pada distributor air minum dalam kemasan dan menentukan prioritas objektif COBIT 2019. " +
      "1. Pendahuluan Usaha kecil dan menengah kini banyak memakai sistem informasi untuk mencatat pekerjaan harian. " +
      "2. Metode Penelitian Studi kasus dengan observasi dan wawancara. " +
      "3. Hasil dan Pembahasan Ada tiga masalah utama. " +
      "4. Kesimpulan Prioritas jatuh pada DSS01 dan BAI07. " +
      "Daftar Pustaka [1] Anwar, S. (2021). Riset Pendidikan. Bandung: Alfabeta.";
    const md = plainTextToMarkdown(collapsed);
    expect(md).toContain("## 1. Pendahuluan");
    expect(md).toContain("## 2. Metode Penelitian");
    expect(md).toContain("## 3. Hasil dan Pembahasan");
    expect(md).toContain("## 4. Kesimpulan");
    expect(md).toContain("## Daftar Pustaka");
  });

  it("splits a heading merged into the other column", () => {
    const md = plainTextToMarkdown(
      "yang tinggi dan perlu dibaca bersama kemampuan 4. \u200B Kesimpulan\nPrioritas jatuh pada DSS01.",
    );
    expect(md).toContain("## 4. Kesimpulan");
    expect(md).toContain("Prioritas jatuh pada DSS01.");
  });
});
