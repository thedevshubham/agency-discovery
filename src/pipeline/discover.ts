import type { Agency } from "@prisma/client";

import { db } from "../db.js";
import {
  normalizeAgencyName,
  type AgencyCandidate,
} from "../discovery/types.js";
import { getCanonicalDomain } from "../utils/domain.js";

export type DiscoverySummary = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
};

function parseSourceUrls(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function addSourceUrl(existing: string, sourceUrl: string): string {
  return JSON.stringify([...new Set([...parseSourceUrls(existing), sourceUrl])]);
}

function addEvidence(existing: string | null, evidence: string | undefined): string | null {
  if (!evidence) {
    return existing;
  }

  return JSON.stringify([
    ...new Set([...parseSourceUrls(existing ?? "[]"), evidence]),
  ]);
}

async function findExistingCandidate(
  candidate: AgencyCandidate,
  normalizedName: string,
  canonicalDomain: string | null,
): Promise<Agency | null> {
  if (canonicalDomain) {
    return db.agency.findUnique({ where: { canonicalDomain } });
  }

  const nameMatches = await db.agency.findMany({ where: { normalizedName } });

  return (
    nameMatches.find((agency) =>
      parseSourceUrls(agency.sourceUrls).includes(candidate.sourceUrl),
    ) ?? null
  );
}

async function saveCandidate(candidate: AgencyCandidate): Promise<"created" | "updated" | "skipped"> {
  const normalizedName = normalizeAgencyName(candidate.name);
  const canonicalDomain = candidate.websiteUrl
    ? getCanonicalDomain(candidate.websiteUrl)
    : null;
  const existing = await findExistingCandidate(
    candidate,
    normalizedName,
    canonicalDomain,
  );

  if (!existing) {
    await db.agency.create({
      data: {
        name: candidate.name,
        normalizedName,
        ...(candidate.websiteUrl ? { websiteUrl: candidate.websiteUrl } : {}),
        canonicalDomain,
        discoverySource: candidate.discoverySource,
        sourceUrls: JSON.stringify([candidate.sourceUrl]),
        discoveryEvidence: candidate.evidence
          ? JSON.stringify([candidate.evidence])
          : null,
      },
    });

    return "created";
  }

  const sourceUrls = addSourceUrl(existing.sourceUrls, candidate.sourceUrl);
  const websiteUrl = existing.websiteUrl ?? candidate.websiteUrl;
  const discoveryEvidence = addEvidence(
    existing.discoveryEvidence,
    candidate.evidence,
  );

  if (
    sourceUrls === existing.sourceUrls &&
    websiteUrl === existing.websiteUrl &&
    discoveryEvidence === existing.discoveryEvidence
  ) {
    return "skipped";
  }

  await db.agency.update({
    where: { id: existing.id },
    data: {
      sourceUrls,
      discoveryEvidence,
      ...(websiteUrl ? { websiteUrl } : {}),
    },
  });

  return "updated";
}

export async function discoverCandidates(
  candidates: AgencyCandidate[],
): Promise<DiscoverySummary> {
  const summary: DiscoverySummary = {
    total: candidates.length,
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const candidate of candidates) {
    const result = await saveCandidate(candidate);
    summary[result] += 1;
  }

  return summary;
}
