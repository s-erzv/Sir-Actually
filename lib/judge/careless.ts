/**
 * careless.ts — deterministic guard for answers that are not an attempt at all
 * (keyboard mashing, filler, repeated noise).
 *
 * It is deliberately conservative: a relevant list of terms is still a valid
 * (thin) answer and is judged by the LLM, never auto-penalised here. Only text
 * no examiner would read as an attempt returns a reason; otherwise null.
 */

const FILLER = new Set([
  "asdf", "qwer", "qwerty", "zxcv", "lorem", "ipsum", "dolor", "bla", "blabla",
  "hehe", "hehehe", "haha", "hahaha", "wkwk", "wkwkwk", "xixi", "test", "tes",
  "coba", "aaa", "zzz", "hmm", "gatau", "gtw", "entah", "dll", "dsb",
]);

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
}

function looksLikeWord(word: string): boolean {
  if (word.length <= 2) return true;
  if (!/[aiueoy]/.test(word)) return false; // no vowel: "qwrt", "zxcv"
  if (/(.)\1{2,}/.test(word)) return false; // "aaaa", "hmmmm"
  return true;
}

export function detectCarelessAnswer(answer: string): string | null {
  const tokens = words(answer);
  if (tokens.length === 0) return "Jawabanmu belum berisi kata apa pun.";

  const filler = tokens.filter((token) => FILLER.has(token) || !looksLikeWord(token)).length;
  if (filler / tokens.length >= 0.5) {
    return "Jawabanmu belum berupa kalimat; tulis alasanmu dengan kata-katamu sendiri.";
  }

  if (new Set(tokens).size <= 2 && tokens.length >= 4) {
    return "Jawabanmu hanya mengulang kata yang sama.";
  }

  return null;
}
