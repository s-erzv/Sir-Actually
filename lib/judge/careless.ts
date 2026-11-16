/**
 * careless.ts — deterministic guard for answers that are not an attempt at all
 * (keyboard mashing, filler, a pile of keywords with no sentence).
 *
 * It is deliberately conservative: it only fires on text no examiner would
 * read as an answer. Everything else goes to the LLM Judge. Returns the
 * player-facing reason, or null when the answer deserves a real reading.
 */

const FILLER = new Set([
  "asdf", "qwer", "qwerty", "zxcv", "lorem", "ipsum", "dolor", "bla", "blabla",
  "hehe", "hehehe", "haha", "hahaha", "wkwk", "wkwkwk", "xixi", "test", "tes",
  "coba", "aaa", "zzz", "hmm", "gatau", "gtw", "entah", "dll", "dsb",
]);

/** Words that make a string of terms into a sentence (ID + EN). */
const CONNECTORS = new Set([
  "karena", "sebab", "sehingga", "jadi", "maka", "agar", "supaya", "untuk",
  "yang", "dan", "atau", "tetapi", "tapi", "namun", "bahwa", "dengan", "dari",
  "pada", "di", "ke", "dalam", "adalah", "ialah", "yaitu", "itu", "ini",
  "saya", "kami", "aku", "tidak", "bukan", "belum", "sudah", "akan", "bisa",
  "because", "so", "that", "the", "and", "but", "with", "from", "is", "are",
  "was", "were", "not", "we", "i", "to", "of", "in", "for",
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

  // A run of terms with no connecting word is a keyword list, not an answer.
  if (tokens.length >= 6 && !tokens.some((token) => CONNECTORS.has(token))) {
    return "Jawabanmu hanya deretan istilah; rangkai menjadi kalimat yang menjawab pertanyaan.";
  }

  return null;
}
