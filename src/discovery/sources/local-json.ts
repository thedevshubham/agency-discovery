import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ZodError } from "zod";

import { candidateListSchema, type AgencyCandidate } from "../types.js";

export async function loadCandidatesFromJson(
  filePath: string,
): Promise<AgencyCandidate[]> {
  const absolutePath = resolve(filePath);
  const contents = await readFile(absolutePath, "utf8");

  let input: unknown;

  try {
    input = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Candidate file is not valid JSON: ${absolutePath}`, {
      cause: error,
    });
  }

  try {
    return candidateListSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues
        .map((issue) => `${issue.path.join(".") || "file"}: ${issue.message}`)
        .join("; ");

      throw new Error(`Candidate validation failed: ${details}`, { cause: error });
    }

    throw error;
  }
}
