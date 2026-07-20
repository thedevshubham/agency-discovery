import { z } from "zod";

export const extractedResumeSchema = z.object({
  text: z
    .string()
    .trim()
    .min(50, "The PDF contains too little extractable text to be a resume")
    .max(1_000_000),
  pageCount: z.number().int().positive().max(100),
});

export type ExtractedResume = z.infer<typeof extractedResumeSchema>;

export function normalizeResumeText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
