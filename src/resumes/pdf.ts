import { readFile } from "node:fs/promises";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import {
  extractedResumeSchema,
  normalizeResumeText,
  type ExtractedResume,
} from "./types.js";

export async function extractResumePdf(filePath: string): Promise<ExtractedResume> {
  const contents = await readFile(filePath);
  const document = await getDocument({
    data: new Uint8Array(contents),
    isEvalSupported: false,
  }).promise;
  const pageCount = document.numPages;
  const pages: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = "";

      for (const item of content.items) {
        if (!("str" in item)) {
          continue;
        }

        pageText += item.str;
        pageText += item.hasEOL ? "\n" : " ";
      }

      pages.push(normalizeResumeText(pageText));
    }
  } finally {
    await document.destroy();
  }

  return extractedResumeSchema.parse({
    text: normalizeResumeText(pages.join("\n\n")),
    pageCount,
  });
}
