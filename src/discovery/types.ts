import { z } from "zod";

import { normalizeUrl } from "../utils/url.js";

const normalizedUrlSchema = z.string().transform((value, context) => {
  const normalized = normalizeUrl(value);

  if (!normalized) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Must be a valid HTTP or HTTPS URL",
    });

    return z.NEVER;
  }

  return normalized;
});

export const candidateSchema = z.object({
  name: z.string().trim().min(1),
  websiteUrl: normalizedUrlSchema.optional(),
  sourceUrl: normalizedUrlSchema,
  discoverySource: z.string().trim().min(1),
  evidence: z.string().trim().min(1).optional(),
});

export const candidateListSchema = z.array(candidateSchema);

export type AgencyCandidate = z.infer<typeof candidateSchema>;

export function normalizeAgencyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
