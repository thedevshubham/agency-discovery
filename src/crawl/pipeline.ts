import { load } from "cheerio";

import { db } from "../db.js";
import { discoverShopifyPartners } from "../discovery/sources/shopify-directory.js";
import { fetchHtmlDocument } from "../fetch/http.js";
import { discoverCandidates } from "../pipeline/discover.js";
import { discoverJobs } from "../pipeline/discover-jobs.js";
import { enrichAgencies } from "../pipeline/enrich.js";
import { reportProgress } from "../progress.js";
import { findCareersUrl } from "../services/careers.js";
import { getCanonicalDomain } from "../utils/domain.js";
import { normalizeUrl } from "../utils/url.js";
import { classifyCrawlUrl } from "./classify-url.js";

export type CrawlLimit = number | "all";

export type CrawlSummary = {
  sourceType: string;
  targetsDiscovered: number;
  targetsProcessed: number;
  careersFound: number;
  jobsFound: number;
  failed: number;
};

function websiteName(html: string, url: string): string {
  const title = load(html)("title").first().text().replace(/\s+/g, " ").trim();
  return title || new URL(url).hostname.replace(/^www\./, "");
}

async function ensureDirectAgency(
  sourceUrl: string,
  document: { html: string; url: string },
  careersUrl: string | null,
): Promise<number> {
  const websiteUrl = normalizeUrl(new URL("/", document.url).toString())!;
  const canonicalDomain = getCanonicalDomain(websiteUrl);
  const existing = canonicalDomain
    ? await db.agency.findUnique({ where: { canonicalDomain } })
    : null;

  if (existing) {
    await db.agency.update({
      where: { id: existing.id },
      data: {
        websiteUrl,
        ...(careersUrl ? { careersUrl, careersCheckedAt: new Date() } : {}),
      },
    });
    return existing.id;
  }

  const discovered = await discoverCandidates([
    {
      name: websiteName(document.html, document.url),
      websiteUrl,
      sourceUrl,
      discoverySource: "direct-url",
      evidence: "Provided directly to the crawl command.",
    },
  ]);

  if (!discovered.agencyIds[0]) {
    throw new Error("Could not persist the website supplied to crawl");
  }

  await db.agency.update({
    where: { id: discovered.agencyIds[0] },
    data: {
      ...(careersUrl ? { careersUrl } : {}),
      careersCheckedAt: new Date(),
    },
  });
  return discovered.agencyIds[0];
}

export async function crawlUrl(url: string, limit: CrawlLimit): Promise<CrawlSummary> {
  const initial = await fetchHtmlDocument(url);
  const sourceType = classifyCrawlUrl(initial.url, initial.html);
  const numericLimit = limit === "all" ? undefined : limit;

  if (sourceType === "shopify-directory") {
    const candidates = await discoverShopifyPartners({
      directoryUrl: initial.url,
      ...(numericLimit ? { limit: numericLimit } : {}),
      onPage: ({ page, totalPages, discovered, directoryUrl }) =>
        reportProgress(
          "crawl:directory",
          numericLimit ? Math.min(discovered, numericLimit) : page,
          numericLimit ?? totalPages ?? page,
          "Directory page processed",
          { directoryUrl, discovered },
        ),
    });
    const discovery = await discoverCandidates(candidates);
    const enrichment = await enrichAgencies({
      agencyIds: discovery.agencyIds,
      onAgency: ({ name, processed, total }) =>
        reportProgress("crawl:careers", processed, total, "Website checked for careers", {
          agency: name,
        }),
    });
    const jobs = await discoverJobs({
      agencyIds: discovery.agencyIds,
      onAgency: ({ name, processed, total, jobsFound }) =>
        reportProgress("crawl:jobs", processed, total, "Careers page checked for jobs", {
          agency: name,
          jobsFound,
        }),
    });

    return {
      sourceType,
      targetsDiscovered: candidates.length,
      targetsProcessed: enrichment.processed,
      careersFound: enrichment.careersFound,
      jobsFound: jobs.jobsFound,
      failed: enrichment.failed + jobs.failed,
    };
  }

  const careersUrl =
    sourceType === "careers-page"
      ? normalizeUrl(initial.url)
      : await findCareersUrl(initial.html, initial.url);
  const agencyId = await ensureDirectAgency(url, initial, careersUrl);

  if (!careersUrl) {
    return {
      sourceType,
      targetsDiscovered: 1,
      targetsProcessed: 1,
      careersFound: 0,
      jobsFound: 0,
      failed: 0,
    };
  }

  const jobs = await discoverJobs({
    agencyIds: [agencyId],
    ...(numericLimit ? { jobLimit: numericLimit } : {}),
    onAgency: ({ name, processed, total, jobsFound }) =>
      reportProgress("crawl:jobs", processed, total, "Careers page checked for jobs", {
        agency: name,
        jobsFound,
      }),
  });

  return {
    sourceType,
    targetsDiscovered: 1,
    targetsProcessed: 1,
    careersFound: 1,
    jobsFound: jobs.jobsFound,
    failed: jobs.failed,
  };
}
