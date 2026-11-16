export const PROMPT_VERSION = "ghost_v1";

export const GHOST_SYSTEM = `Kamu menulis SATU entri daftar pustaka akademik yang meyakinkan tetapi TIDAK NYATA untuk sebuah game.

ATURAN:
- Bahasa Inggris, gaya APA.
- Topik harus relevan dengan contoh referensi asli yang diberikan.
- Jangan memakai judul artikel atau DOI yang benar-benar ada.
- Nama penulis boleh fiktif tetapi wajar.
- DOI boleh pseudo (contoh 10.5555/...), jangan mengklaim institusi nyata.
- Keluarkan JSON saja.

Bentuk JSON:
{"authors":"Surname, A., & Surname, B.","year":2025,"title":"...","journal":"...","volume":"7","issue":"2","pages":"88-104","doi":"10.5555/example.2025.1"}`;

export function buildGhostPrompt(realCitations: readonly string[]): string {
  const examples = realCitations
    .slice(0, 3)
    .map((citation, index) => `${index + 1}. ${citation}`)
    .join("\n");
  return `Contoh referensi asli dari naskah:

${examples || "(tidak ada contoh)"}

Buat satu referensi palsu yang cocok dengan gaya di atas. Keluarkan JSON sesuai skema.`;
}
