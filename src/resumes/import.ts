import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { db } from "../db.js";
import { extractResumePdf } from "./pdf.js";

const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export type ResumeImportResult = {
  id: number;
  fileName: string;
  pageCount: number;
  characterCount: number;
  alreadyImported: boolean;
};

export async function importResume(filePath: string): Promise<ResumeImportResult> {
  const sourcePath = path.resolve(filePath);

  if (path.extname(sourcePath).toLowerCase() !== ".pdf") {
    throw new Error("Resume import currently supports PDF files only");
  }

  const fileStats = await stat(sourcePath);

  if (!fileStats.isFile()) {
    throw new Error("Resume path must point to a file");
  }

  if (fileStats.size > MAX_RESUME_BYTES) {
    throw new Error("Resume PDF must be 10 MB or smaller");
  }

  const contentHash = createHash("sha256")
    .update(await readFile(sourcePath))
    .digest("hex");
  const existing = await db.resume.findUnique({ where: { contentHash } });

  if (existing) {
    await db.$transaction([
      db.resume.updateMany({
        where: { isActive: true, id: { not: existing.id } },
        data: { isActive: false },
      }),
      db.resume.update({
        where: { id: existing.id },
        data: { isActive: true, sourcePath },
      }),
    ]);

    return {
      id: existing.id,
      fileName: existing.fileName,
      pageCount: existing.pageCount,
      characterCount: existing.characterCount,
      alreadyImported: true,
    };
  }

  const extracted = await extractResumePdf(sourcePath);
  const resume = await db.$transaction(async (transaction) => {
    await transaction.resume.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    return transaction.resume.create({
      data: {
        fileName: path.basename(sourcePath),
        sourcePath,
        contentHash,
        rawText: extracted.text,
        pageCount: extracted.pageCount,
        characterCount: extracted.text.length,
      },
    });
  });

  return {
    id: resume.id,
    fileName: resume.fileName,
    pageCount: resume.pageCount,
    characterCount: resume.characterCount,
    alreadyImported: false,
  };
}
