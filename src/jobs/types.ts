import { createHash } from "node:crypto";

import { z } from "zod";

import { normalizeAgencyName } from "../discovery/types.js";
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

export const jobCandidateSchema = z.object({
  title: z.string().trim().min(2),
  jobUrl: normalizedUrlSchema,
  applicationUrl: normalizedUrlSchema.optional(),
  location: z.string().trim().min(1).optional(),
  workplaceType: z.enum(["remote", "hybrid", "onsite"]).optional(),
  employmentType: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  externalId: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1),
});

export type JobCandidate = z.infer<typeof jobCandidateSchema>;

export function normalizeJobTitle(title: string): string {
  return normalizeAgencyName(title);
}

export function createCanonicalJobKey(
  agencyId: number,
  candidate: Pick<JobCandidate, "title" | "jobUrl" | "externalId" | "source">,
): string {
  const identity = candidate.externalId
    ? `${candidate.source}:${candidate.externalId}`
    : `${candidate.jobUrl}:${normalizeJobTitle(candidate.title)}`;

  return createHash("sha256")
    .update(`${agencyId}:${identity}`)
    .digest("hex");
}
