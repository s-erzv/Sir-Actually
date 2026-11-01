export async function extractManuscriptText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return normalize(result.value);
  }

  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      for (const item of content.items) {
        if ("str" in item) {
          lines.push(item.str);
          if ("hasEOL" in item && item.hasEOL) lines.push("\n");
        }
      }
      pages.push(lines.join(" "));
    }
    const text = normalize(pages.join("\n\n"));
    if (text.length < 300) {
      throw new Error("PDF tidak memiliki teks yang cukup. Gunakan PDF berteks, bukan hasil scan.");
    }
    return text;
  }

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return normalize(await file.text());
  }

  throw new Error("Format tidak didukung. Gunakan .docx, PDF berteks, .txt, atau .md.");
}

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}
