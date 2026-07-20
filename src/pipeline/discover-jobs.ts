import { JobStatus } from "@prisma/client";

import { db } from "../db.js";
import { fetchHtmlDocument } from "../fetch/http.js";
import { parseGenericJobsPage } from "../jobs/generic-parser.js";
import {
  createCanonicalJobKey,
  normalizeJobTitle,
  type JobCandidate,
} from "../jobs/types.js";
import { isCareersPage } from "../services/careers.js";

export type JobDiscoveryOptions = {
  limit?: number;
  jobLimit?: number;
  agencyIds?: number[];
  delayMs?: number;
  onAgency?: (progress: {
    agencyId: number;
    name: string;
    processed: number;
    total: number;
    jobsFound: number;
  }) => void;
};

export type JobDiscoverySummary = {
  agencies: number;
  processed: number;
  jobsFound: number;
  jobsCreated: number;
  jobsUpdated: number;
  jobsDeleted: number;
  invalidCareersPages: number;
  failed: number;
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function saveJobs(
  agencyId: number,
  candidates: JobCandidate[],
  deleteMissing: boolean,
): Promise<{ created: number; updated: number; deleted: number }> {
  const seenKeys: string[] = [];
  let created = 0;
  let updated = 0;
  const now = new Date();

  for (const candidate of candidates) {
    const canonicalJobKey = createCanonicalJobKey(agencyId, candidate);
    const existing = await db.job.findUnique({ where: { canonicalJobKey } });
    seenKeys.push(canonicalJobKey);

    const data = {
      title: candidate.title,
      normalizedTitle: normalizeJobTitle(candidate.title),
      jobUrl: candidate.jobUrl,
      location: candidate.location ?? null,
      workplaceType: candidate.workplaceType ?? null,
      employmentType: candidate.employmentType ?? null,
      description: candidate.description ?? null,
      externalId: candidate.externalId ?? null,
      source: candidate.source,
      status: JobStatus.ACTIVE,
      lastSeenAt: now,
    };

    if (existing) {
      await db.job.update({
        where: { id: existing.id },
        data,
      });
      updated += 1;
    } else {
      await db.job.create({
        data: {
          agencyId,
          canonicalJobKey,
          ...data,
        },
      });
      created += 1;
    }
  }

  if (!deleteMissing) {
    return { created, updated, deleted: 0 };
  }

  const deleted = await db.job.deleteMany({
    where: {
      agencyId,
      canonicalJobKey: { notIn: seenKeys },
    },
  });

  return { created, updated, deleted: deleted.count };
}

export async function discoverJobs(
  options: JobDiscoveryOptions = {},
): Promise<JobDiscoverySummary> {
  const agencies = await db.agency.findMany({
    where: {
      careersUrl: { not: null },
      ...(options.agencyIds ? { id: { in: options.agencyIds } } : {}),
    },
    orderBy: [{ jobsCheckedAt: "asc" }, { id: "asc" }],
    ...(options.limit ? { take: options.limit } : {}),
  });
  const summary: JobDiscoverySummary = {
    agencies: agencies.length,
    processed: 0,
    jobsFound: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsDeleted: 0,
    invalidCareersPages: 0,
    failed: 0,
  };

  for (const agency of agencies) {
    let jobsFound = 0;

    try {
      const document = await fetchHtmlDocument(agency.careersUrl!);

      if (!isCareersPage(document.html, document.url)) {
        summary.invalidCareersPages += 1;
        await db.agency.update({
          where: { id: agency.id },
          data: {
            lastError: "Stored careers URL did not resolve to a careers page",
            jobsCheckedAt: new Date(),
          },
        });
      } else {
        const parsedCandidates = parseGenericJobsPage(document.html, document.url);
        const candidates = options.jobLimit
          ? parsedCandidates.slice(0, options.jobLimit)
          : parsedCandidates;
        const saved = await saveJobs(
          agency.id,
          candidates,
          options.jobLimit === undefined,
        );
        jobsFound = candidates.length;
        summary.jobsFound += jobsFound;
        summary.jobsCreated += saved.created;
        summary.jobsUpdated += saved.updated;
        summary.jobsDeleted += saved.deleted;

        await db.agency.update({
          where: { id: agency.id },
          data: { jobsCheckedAt: new Date(), lastError: null },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failed += 1;

      await db.agency.update({
        where: { id: agency.id },
        data: {
          lastError: message.slice(0, 2_000),
          lastAttemptedAt: new Date(),
        },
      });
    }

    summary.processed += 1;
    options.onAgency?.({
      agencyId: agency.id,
      name: agency.name,
      processed: summary.processed,
      total: summary.agencies,
      jobsFound,
    });

    if ((options.delayMs ?? 500) > 0 && summary.processed < summary.agencies) {
      await wait(options.delayMs ?? 500);
    }
  }

  return summary;
}
