import { DiscoveryStatus, type Agency } from "@prisma/client";

import { db } from "../db.js";
import { extractOfficialWebsiteFromShopifyProfile } from "../discovery/sources/shopify-profile.js";
import { fetchHtml, fetchHtmlDocument } from "../fetch/http.js";
import { findCareersUrl } from "../services/careers.js";
import { getCanonicalDomain } from "../utils/domain.js";
import { normalizeUrl } from "../utils/url.js";

const SHOPIFY_PROFILE_PATH = "/partners/directory/partner/";

export type EnrichmentSummary = {
  total: number;
  processed: number;
  homepagesFound: number;
  careersFound: number;
  noCareersFound: number;
  duplicates: number;
  failed: number;
};

export type EnrichmentOptions = {
  limit?: number;
  delayMs?: number;
  onAgency?: (progress: {
    agencyId: number;
    name: string;
    processed: number;
    total: number;
  }) => void;
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function getShopifyProfileUrl(agency: Agency): string | null {
  return (
    parseStringArray(agency.sourceUrls).find((url) =>
      url.includes(SHOPIFY_PROFILE_PATH),
    ) ?? null
  );
}

async function resolveHomepage(agency: Agency): Promise<string> {
  if (agency.websiteUrl) {
    return agency.websiteUrl;
  }

  const profileUrl = getShopifyProfileUrl(agency);

  if (!profileUrl) {
    throw new Error("No Shopify partner profile URL is available");
  }

  const profileHtml = await fetchHtml(profileUrl);
  const homepage = extractOfficialWebsiteFromShopifyProfile(profileHtml);

  if (!homepage) {
    throw new Error("Shopify profile does not expose an official website");
  }

  return homepage;
}

async function markFailure(agencyId: number, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);

  await db.agency.update({
    where: { id: agencyId },
    data: {
      status: DiscoveryStatus.FAILED,
      lastError: message.slice(0, 2_000),
      attemptCount: { increment: 1 },
      lastAttemptedAt: new Date(),
    },
  });
}

async function enrichAgency(
  agency: Agency,
): Promise<"careers" | "no-careers" | "duplicate"> {
  const homepageCandidate = await resolveHomepage(agency);
  const homepageDocument = await fetchHtmlDocument(homepageCandidate);
  const homepageUrl = normalizeUrl(homepageDocument.url);

  if (!homepageUrl) {
    throw new Error("Official website redirected to an invalid URL");
  }

  const canonicalDomain = getCanonicalDomain(homepageUrl);

  if (!canonicalDomain) {
    throw new Error("Could not determine the official website domain");
  }

  const duplicate = await db.agency.findFirst({
    where: {
      canonicalDomain,
      id: { not: agency.id },
    },
    select: { id: true },
  });

  if (duplicate) {
    await db.agency.update({
      where: { id: agency.id },
      data: {
        websiteUrl: homepageUrl,
        status: DiscoveryStatus.REJECTED,
        rejectionReason: `Duplicate canonical domain of agency ${duplicate.id}`,
        lastError: null,
        lastAttemptedAt: new Date(),
      },
    });

    return "duplicate";
  }

  await db.agency.update({
    where: { id: agency.id },
    data: {
      websiteUrl: homepageUrl,
      canonicalDomain,
      isShopifyFocused: true,
      shopifyEvidence: JSON.stringify([getShopifyProfileUrl(agency)].filter(Boolean)),
      status: DiscoveryStatus.SHOPIFY_VERIFIED,
      websiteVerifiedAt: new Date(),
      shopifyVerifiedAt: new Date(),
      lastError: null,
      lastAttemptedAt: new Date(),
    },
  });

  const careersUrl = await findCareersUrl(
    homepageDocument.html,
    homepageUrl,
  );

  await db.agency.update({
    where: { id: agency.id },
    data: {
      careersUrl,
      careersCheckedAt: new Date(),
      status: DiscoveryStatus.CAREERS_CHECKED,
      lastError: null,
    },
  });

  return careersUrl ? "careers" : "no-careers";
}

export async function enrichAgencies(
  options: EnrichmentOptions = {},
): Promise<EnrichmentSummary> {
  const agencies = await db.agency.findMany({
    where: {
      discoverySource: "shopify-partner-directory",
      careersCheckedAt: null,
      status: {
        in: [DiscoveryStatus.DISCOVERED, DiscoveryStatus.FAILED],
      },
    },
    orderBy: { id: "asc" },
    ...(options.limit ? { take: options.limit } : {}),
  });
  const summary: EnrichmentSummary = {
    total: agencies.length,
    processed: 0,
    homepagesFound: 0,
    careersFound: 0,
    noCareersFound: 0,
    duplicates: 0,
    failed: 0,
  };

  for (const agency of agencies) {
    try {
      const result = await enrichAgency(agency);

      if (result === "duplicate") {
        summary.duplicates += 1;
      } else {
        summary.homepagesFound += 1;
        summary[result === "careers" ? "careersFound" : "noCareersFound"] += 1;
      }
    } catch (error) {
      summary.failed += 1;
      await markFailure(agency.id, error);
    }

    summary.processed += 1;
    options.onAgency?.({
      agencyId: agency.id,
      name: agency.name,
      processed: summary.processed,
      total: summary.total,
    });

    if ((options.delayMs ?? 500) > 0 && summary.processed < summary.total) {
      await wait(options.delayMs ?? 500);
    }
  }

  return summary;
}
