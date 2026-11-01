import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const HEADING_WORDS = String.raw`(?:bab\s+[ivxlcdm]+\b.*|pendahuluan|latar\s+belakang|tinjauan\s+pustaka|tujuan\s+penelitian|tujuan|rumusan\s+masalah|pertanyaan\s+penelitian|metode\s+penelitian|metode|metodologi|hasil\s+dan\s+pembahasan|hasil\s+penelitian|hasil|pembahasan|kesimpulan\s+dan\s+saran|kesimpulan|simpulan|daftar\s+(?:pustaka|rujukan|referensi|bacaan)|abstract|abstrak|introduction|related\s+work|methodology|methods?|results?|discussion|conclusions?|references?)`;

const HEADING_PREFIX = String.raw`^(?:\d+(?:\.\d+)*[.)]?\s*)?`;

const HEADING = new RegExp(`${HEADING_PREFIX}${HEADING_WORDS}$`, "i");

export async function extractManuscriptText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return htmlToMarkdown(result.value);
  }

  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(pdfItemsToText(content.items));
    }
    const markdown = plainTextToMarkdown(pages.join("\n\n"));
    if (markdown.length < 300) {
      throw new Error("PDF tidak memiliki teks yang cukup. Gunakan PDF berteks, bukan hasil scan.");
    }
    return markdown;
  }

  if (name.endsWith(".txt")) {
    return plainTextToMarkdown(await file.text());
  }

  if (name.endsWith(".md")) {
    return sanitizeMarkdown(await file.text());
  }

  throw new Error("Format tidak didukung. Gunakan .docx, PDF berteks, .txt, atau .md.");
}

export function htmlToMarkdown(html: string): string {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  service.use(gfm);
  service.remove(["script", "style", "iframe", "object"]);
  service.addRule("dropImages", {
    filter: ["img"],
    replacement: () => "",
  });
  service.addRule("stripInline", {
    filter: ["strong", "em", "b", "i", "u", "span", "mark"],
    replacement: (content) => content,
  });
  service.addRule("linkText", {
    filter: ["a"],
    replacement: (content) => content,
  });
  return sanitizeMarkdown(service.turndown(html));
}

interface PdfItemLike {
  str?: unknown;
  width?: unknown;
  transform?: unknown;
}

interface PdfPosition {
  text: string;
  x: number;
  y: number;
  width: number;
}

/**
 * Rebuild lines from PDF text items using their baseline and horizontal
 * positions. Many PDFs never set `hasEOL`, which used to collapse an entire
 * page (including section headings) into one paragraph.
 */
export function pdfItemsToText(items: readonly unknown[]): string {
  const positions: PdfPosition[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as PdfItemLike;
    if (typeof item.str !== "string" || item.str.length === 0) continue;
    const transform = Array.isArray(item.transform) ? item.transform : null;
    if (!transform) continue;
    positions.push({
      text: item.str,
      x: Number(transform[4]) || 0,
      y: Number(transform[5]) || 0,
      width: typeof item.width === "number" ? item.width : 0,
    });
  }
  if (positions.length === 0) return "";

  positions.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: PdfPosition[][] = [];
  for (const position of positions) {
    const current = lines.at(-1);
    if (current && Math.abs(current[0]!.y - position.y) <= 3) current.push(position);
    else lines.push([position]);
  }

  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      let text = "";
      let lineEnd = 0;
      for (const part of line) {
        if (text.length > 0 && part.x - lineEnd > 1) text += " ";
        text += part.text;
        lineEnd = part.x + part.width;
      }
      return text.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean)
    .join("\n");
}

const INLINE_HEADING = new RegExp(
  String.raw`\s+(\d+(?:\.\d+)*[.)]?\s*${HEADING_WORDS})\b`,
  "gi",
);

const LINE_HEADING = new RegExp(
  String.raw`^(\d+(?:\.\d+)*[.)]?\s*${HEADING_WORDS})\b(.*)$`,
  "i",
);

/**
 * Safety net for PDFs whose text layer collapses several visual lines into one
 * paragraph, or interleaves two columns on the same baseline. Only numbered
 * headings are promoted, so normal prose is left alone.
 */
function splitInlineHeadings(text: string): string {
  return text
    .split("\n")
    .map((rawLine) => {
      const line = rawLine.replace(/[ \t]+/g, " ");
      if (line.startsWith("#")) return line;

      // Heading at the start of a line merged with the other PDF column.
      const startHeading = line.match(LINE_HEADING);
      let result =
        startHeading && startHeading[2]!.trim()
          ? `## ${startHeading[1]}\n\n${startHeading[2]!.trimStart()}`
          : line;
      // Heading somewhere in the middle of a merged two-column line.
      result = result.replace(INLINE_HEADING, "\n\n## $1\n\n");
      if (/##[^\n]*daftar\s+(?:pustaka|rujukan|referensi|bacaan)/i.test(result)) {
        return result;
      }
      return result.replace(
        /\s+(daftar\s+(?:pustaka|rujukan|referensi|bacaan))\s+/gi,
        "\n\n## $1\n\n",
      );
    })
    .join("\n");
}

export function plainTextToMarkdown(text: string): string {
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  const lines = splitInlineHeadings(normalized).split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    const joined = paragraph.map((line) => line.trim()).join(" ").trim();
    if (joined) out.push(joined);
    paragraph = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      if (out.length > 0 && out.at(-1) !== "") out.push("");
      continue;
    }
    if (isHeading(line)) {
      flush();
      out.push(`## ${line.replace(/^#+\s*/, "").trim()}`);
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      flush();
      out.push(`- ${line.replace(/^[-*•]\s+/, "")}`);
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return sanitizeMarkdown(out.join("\n"));
}

function isHeading(line: string): boolean {
  if (line.length > 90) return false;
  if (line.startsWith("#")) return true;
  if (HEADING.test(line)) return true;
  if (/^[A-Z0-9\s.,:;()/-]{4,80}$/.test(line) && /[A-Z]/.test(line)) return true;
  return false;
}

function sanitizeMarkdown(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}
