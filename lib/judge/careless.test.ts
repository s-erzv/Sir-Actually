import { describe, expect, it } from "vitest";
import { detectCarelessAnswer } from "./careless";

describe("detectCarelessAnswer", () => {
  it.each([
    "asdf qwer lorem ipsum bla bla bla hehehe wkwk",
    "aaaa aaaa aaaa aaaa",
    "... !!!",
  ])("menandai jawaban tanpa isi: %s", (answer) => {
    expect(detectCarelessAnswer(answer)).not.toBeNull();
  });

  it.each([
    "Karena saya ingin melihat hubungan antara dua variabel itu.",
    "Jujur saya belum punya alasan kuat untuk pilihan ini.",
    "5 responden, dipilih acak, menurut saya cukup",
    "Sampel jenuh.",
    "I chose correlation because the question asks about a relationship.",
    // Relevant terms without statistics are still a thin answer, not nonsense.
    "metode korelasi pearson sampel data valid reliabel signifikan penelitian kuantitatif",
    "wawancara mendalam karena pengalaman guru tidak tertangkap angket",
  ])("membiarkan jawaban sungguhan dinilai Judge: %s", (answer) => {
    expect(detectCarelessAnswer(answer)).toBeNull();
  });
});
