/**
 * Live Judge calibration. Calls the real LLM, so it is skipped unless
 * RUN_LLM_EVAL=1:
 *
 *   RUN_LLM_EVAL=1 pnpm vitest run lib/judge/judgeEval.live.test.ts
 *
 * Thresholds were fixed before looking at results (BRIEF §11): a careless
 * answer never earns level 2 and never out-scores a relevant one; a relevant
 * answer without numbers never costs a Heart.
 */
import { describe, expect, it } from "vitest";
import { evaluateAnswer } from "./evaluate";
import { getLLMProviderForJudge } from "@/lib/llm";
import type { RubricCriterion, WeaknessType } from "@/lib/domain/types";

const live = process.env.RUN_LLM_EVAL === "1";
if (live) process.loadEnvFile(".env.local");

const SOURCE = `# Pengaruh Intensitas Media Sosial terhadap Prestasi Belajar Mahasiswa

## Metode
Penelitian ini menggunakan pendekatan kuantitatif dengan desain korelasional. Sampel berjumlah 45 mahasiswa angkatan 2022 Program Studi Pendidikan Ekonomi. Data dikumpulkan dengan angket skala Likert dan dianalisis dengan korelasi Pearson.

## Hasil
Hasil analisis menunjukkan r = -0,41 dengan p = 0,005 antara intensitas penggunaan media sosial dan indeks prestasi.

## Kesimpulan
Media sosial menyebabkan turunnya prestasi belajar mahasiswa di Indonesia.`;

interface Case {
  name: string;
  answer: string;
  /** Inclusive bounds on the single target criterion level. */
  level: [number, number];
  /** Omit when either outcome is acceptable. */
  heartLost?: boolean;
}

interface Suite {
  weaknessType: WeaknessType;
  question: string;
  evidenceQuote: string;
  criterion: RubricCriterion;
  cases: Case[];
}

const SUITES: Suite[] = [
  {
    weaknessType: "rq_method_mismatch",
    question: "Mengapa kamu memilih korelasi Pearson untuk menjawab pertanyaan penelitianmu?",
    evidenceQuote: "dianalisis dengan korelasi Pearson",
    criterion: { id: "method_justified", label: "Pilihan metode dibenarkan dengan alasan" },
    cases: [
      {
        name: "relevan + beralasan, tanpa angka",
        answer:
          "Saya memilih korelasi karena pertanyaan penelitian saya menanyakan hubungan antara dua variabel, bukan sebab akibat. Kedua variabelnya berskala interval sehingga korelasi Pearson cocok, dan saya tidak memberi perlakuan apa pun ke responden.",
        level: [2, 2],
        heartLost: false,
      },
      {
        name: "relevan + beralasan + data",
        answer:
          "Pertanyaan penelitian saya soal hubungan intensitas media sosial dengan indeks prestasi pada 45 mahasiswa. Dua-duanya data interval dari angket Likert, jadi Pearson sesuai untuk mengukur arah dan kekuatan hubungan, hasilnya r = -0,41.",
        level: [2, 2],
        heartLost: false,
      },
      {
        name: "relevan tapi singkat",
        answer: "Karena saya ingin melihat hubungan antara dua variabel itu.",
        level: [1, 1],
        heartLost: false,
      },
      {
        name: "jujur mengakui belum kuat",
        answer:
          "Jujur saya belum punya alasan kuat. Saya mengikuti penelitian terdahulu yang memakai korelasi, tapi saya sadar belum menjelaskan kenapa cocok dengan pertanyaan penelitian saya.",
        level: [0, 1],
        heartLost: false,
      },
      {
        name: "asal: yakin tanpa isi",
        answer: "Ya pokoknya metode saya sudah benar dan bagus, menurut saya itu sudah cukup kok.",
        level: [0, 0],
        heartLost: true,
      },
      {
        name: "asal: ketikan acak",
        answer: "asdf qwer lorem ipsum bla bla bla hehehe wkwk",
        level: [0, 0],
        heartLost: true,
      },
      {
        name: "di luar topik",
        answer:
          "Daftar pustaka saya sudah memakai format APA edisi ketujuh dan semua jurnalnya terbit lima tahun terakhir.",
        level: [0, 0],
        heartLost: true,
      },
      {
        name: "asal: tumpukan kata kunci",
        answer:
          "metode korelasi pearson sampel data valid reliabel signifikan penelitian kuantitatif hubungan variabel",
        level: [0, 0],
        heartLost: true,
      },
    ],
  },
  {
    // Dweller comprehension check: quiz an existing claim, never allege a flaw.
    weaknessType: "comprehension" as WeaknessType,
    question: "Jelaskan dengan kata-katamu sendiri apa maksud bagian metode ini dan apa dasarnya di naskahmu?",
    evidenceQuote: "Sampel berjumlah 45 mahasiswa angkatan 2022",
    criterion: { id: "claim_explained", label: "Menjelaskan klaim dengan kata sendiri dan sesuai naskah" },
    cases: [
      {
        name: "menjelaskan dengan kata sendiri",
        answer:
          "Bagian itu menjelaskan bahwa penelitian ini mengambil 45 mahasiswa angkatan 2022 sebagai sampel, lalu datanya dikumpulkan lewat angket dan dianalisis dengan korelasi Pearson untuk melihat hubungan dua variabel.",
        level: [2, 2],
        heartLost: false,
      },
      {
        name: "di luar topik",
        answer: "Menurut saya daftar pustaka sebaiknya memakai APA edisi ketujuh dan jurnal lima tahun terakhir.",
        level: [0, 0],
        heartLost: true,
      },
    ],
  },
  {
    weaknessType: "sample_unreported",
    question: "Jelaskan mengapa 45 responden cukup untuk analisis korelasimu?",
    evidenceQuote: "Sampel berjumlah 45 mahasiswa angkatan 2022",
    criterion: { id: "sample_justified", label: "Kecukupan sampel dibenarkan dengan alasan/angka" },
    cases: [
      {
        name: "sampel jenuh, beralasan",
        answer:
          "Empat puluh lima itu adalah seluruh mahasiswa aktif angkatan 2022 di prodi saya, jadi saya memakai sampel jenuh. Karena seluruh populasi sasaran ikut, saya tidak perlu menghitung ukuran sampel minimum, tapi hasilnya hanya berlaku untuk angkatan itu.",
        level: [2, 2],
        heartLost: false,
      },
      {
        name: "BRIEF: jawaban asal tidak boleh level 2",
        answer: "5 responden, dipilih acak, menurut saya cukup",
        level: [0, 1],
      },
    ],
  },
];

describe.skipIf(!live)("Judge kalibrasi (LLM nyata)", () => {
  for (const suite of SUITES) {
    for (const testCase of suite.cases) {
      it.concurrent(
        `${suite.criterion.id}: ${testCase.name}`,
        async () => {
          const result = await evaluateAnswer(getLLMProviderForJudge(process.env.EVAL_BOSS ?? "minion"), {
            playerAnswer: testCase.answer,
            question: suite.question,
            evidenceQuote: suite.evidenceQuote,
            weaknessType: suite.weaknessType,
            targetCriteria: [suite.criterion],
            sourceText: SOURCE,
            knownCitations: [],
            contextChunks: [{ section: "Metode", text: SOURCE }],
          });
          const level = result.scores[0]?.level ?? 0;
          console.log(
            `[${suite.criterion.id}] ${testCase.name} -> level ${level}, addressed ${result.addressed}, heart ${result.heartLost} | ${result.missing}`,
          );
          expect(level).toBeGreaterThanOrEqual(testCase.level[0]);
          expect(level).toBeLessThanOrEqual(testCase.level[1]);
          if (testCase.heartLost !== undefined) {
            expect(result.heartLost).toBe(testCase.heartLost);
          }
        },
        120_000,
      );
    }
  }
});
