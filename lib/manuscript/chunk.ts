export interface ManuscriptChunk {
  chunkIndex: number;
  sectionLabel: string | null;
  charStart: number;
  charEnd: number;
  text: string;
}

const HEADING_PATTERNS = [
  /^(?:bab\s+[ivxlcdm]+\b.*)$/i,
  /^(?:pendahuluan|latar\s+belakang|tinjauan\s+pustaka|metode(?:\s+penelitian)?|metodologi|hasil(?:\s+penelitian)?|pembahasan|kesimpulan|daftar\s+pustaka|abstract|introduction|related\s+work|methodology|methods?|results?|discussion|conclusions?|references?)$/i,
];

function isHeading(line: string): boolean {
  const trimmed = line.trim().replace(/^#{1,6}\s*/, "");
  if (trimmed.length === 0 || trimmed.length > 90) return false;
  return HEADING_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Split by headings and paragraphs. Target 200–400 words per chunk.
 * Pure; pure offsets are 0-based indices into sourceText.
 */
export function chunkManuscript(
  sourceText: string,
  targetWords = 300,
): ManuscriptChunk[] {
  const lines = sourceText.split(/\r?\n/);
  const chunks: ManuscriptChunk[] = [];
  let sectionLabel: string | null = null;
  let paragraphLines: string[] = [];
  let paragraphStart = 0;
  let offset = 0;

  const flushParagraph = (endOffset: number) => {
    const text = paragraphLines.join("\n").trim();
    paragraphLines = [];
    if (!text) return;

    const words = text.split(/\s+/).filter(Boolean).length;
    const last = chunks[chunks.length - 1];
    const canMerge =
      last &&
      last.sectionLabel === sectionLabel &&
      last.text.split(/\s+/).filter(Boolean).length + words <= targetWords;

    if (canMerge) {
      last.text = `${last.text}\n\n${text}`;
      last.charEnd = endOffset;
    } else {
      chunks.push({
        chunkIndex: chunks.length,
        sectionLabel,
        charStart: paragraphStart,
        charEnd: endOffset,
        text,
      });
    }
  };

  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1;

    if (isHeading(line)) {
      if (paragraphLines.length > 0) flushParagraph(lineStart);
      sectionLabel = line.trim().replace(/^#{1,6}\s*/, "");
      continue;
    }

    if (line.trim() === "") {
      if (paragraphLines.length > 0) flushParagraph(lineStart);
      continue;
    }

    if (paragraphLines.length === 0) paragraphStart = lineStart;
    paragraphLines.push(line);
  }

  if (paragraphLines.length > 0) flushParagraph(sourceText.length);

  return chunks;
}
