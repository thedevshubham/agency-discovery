import { db } from "../db.js";
import { importResume, type ResumeImportResult } from "./import.js";

export async function getActiveResume() {
  return db.resume.findFirst({
    where: { isActive: true },
    orderBy: { importedAt: "desc" },
    select: {
      id: true,
      fileName: true,
      pageCount: true,
      characterCount: true,
      importedAt: true,
    },
  });
}

export async function uploadResume(filePath: string): Promise<ResumeImportResult> {
  if (await getActiveResume()) {
    throw new Error(
      "An active resume already exists. Use 'resume update <file.pdf>' to replace it.",
    );
  }

  return importResume(filePath);
}

export async function updateResume(filePath: string): Promise<ResumeImportResult> {
  if (!(await getActiveResume())) {
    throw new Error(
      "No active resume exists. Use 'resume upload <file.pdf>' first.",
    );
  }

  return importResume(filePath);
}
