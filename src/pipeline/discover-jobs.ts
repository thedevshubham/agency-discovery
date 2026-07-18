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
  jobsDeactivated: number;
  invalidCareersPages: number;
  failed: number;
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function saveJobs(
  agencyId: number,
  candidates: JobCandidate[],
): Promise<{ created: number; updated: number; deactivated: number }> {
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
      applicationUrl: candidate.applicationUrl ?? null,
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

  if (seenKeys.length === 0) {
    return { created, updated, deactivated: 0 };
  }

  const deactivated = await db.job.updateMany({
    where: {
      agencyId,
      status: JobStatus.ACTIVE,
      canonicalJobKey: { notIn: seenKeys },
    },
    data: { status: JobStatus.INACTIVE },
  });

  return { created, updated, deactivated: deactivated.count };
}

export async function discoverJobs(
  options: JobDiscoveryOptions = {},
): Promise<JobDiscoverySummary> {
  const agencies = await db.agency.findMany({
    where: { careersUrl: { not: null } },
    orderBy: [{ jobsCheckedAt: "asc" }, { id: "asc" }],
    ...(options.limit ? { take: options.limit } : {}),
  });
  const summary: JobDiscoverySummary = {
    agencies: agencies.length,
    processed: 0,
    jobsFound: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsDeactivated: 0,
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
        const candidates = parseGenericJobsPage(document.html, document.url);
        const saved = await saveJobs(agency.id, candidates);
        jobsFound = candidates.length;
        summary.jobsFound += jobsFound;
        summary.jobsCreated += saved.created;
        summary.jobsUpdated += saved.updated;
        summary.jobsDeactivated += saved.deactivated;

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
