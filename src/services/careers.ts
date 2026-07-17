import { load } from "cheerio";

import { fetchHtmlDocument } from "../fetch/http.js";
import { normalizeUrl } from "../utils/url.js";

const CAREERS_TEXT_PATTERN =
  /\b(careers?|jobs?|join\s+(us|our\s+team)|work\s+with\s+us|open\s+positions?|vacancies|we(?:'|’)re\s+hiring)\b/i;
const CAREERS_PATH_PATTERN =
  /\/(careers?|jobs?|join-us|join-our-team|work-with-us|open-positions?|vacancies)(?:[/?#-]|$)/i;

const COMMON_CAREERS_PATHS = [
  "/careers",
  "/jobs",
  "/join-us",
  "/about/careers",
] as const;

type CareersCandidate = {
  url: string;
  score: number;
};

function scoreCareersLink(text: string, url: string): number {
  let score = 0;

  if (CAREERS_TEXT_PATTERN.test(text)) {
    score += 3;
  }

  if (CAREERS_PATH_PATTERN.test(url)) {
    score += 4;
  }

  if (/\b(careers?|jobs?)\b/i.test(text.trim())) {
    score += 2;
  }

  return score;
}

export function extractCareersUrl(
  html: string,
  homepageUrl: string,
): string | null {
  const $ = load(html);
  const candidates = new Map<string, CareersCandidate>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");

    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href.trim())) {
      return;
    }

    let absoluteUrl: string;

    try {
      absoluteUrl = new URL(href, homepageUrl).toString();
    } catch {
      return;
    }

    const normalized = normalizeUrl(absoluteUrl);

    if (!normalized) {
      return;
    }

    const text = $(element).text().replace(/\s+/g, " ").trim();
    const score = scoreCareersLink(text, normalized);

    if (score === 0) {
      return;
    }

    const existing = candidates.get(normalized);

    if (!existing || score > existing.score) {
      candidates.set(normalized, { url: normalized, score });
    }
  });

  return (
    [...candidates.values()].sort((first, second) => second.score - first.score)[0]
      ?.url ?? null
  );
}

export function isCareersPage(html: string, url: string): boolean {
  if (CAREERS_PATH_PATTERN.test(url)) {
    return true;
  }

  const $ = load(html);
  const titleAndHeadings = $("title, h1, h2")
    .text()
    .replace(/\s+/g, " ")
    .trim();

  return CAREERS_TEXT_PATTERN.test(titleAndHeadings);
}

export async function findCareersUrl(
  homepageHtml: string,
  homepageUrl: string,
): Promise<string | null> {
  const linkedCareersUrl = extractCareersUrl(homepageHtml, homepageUrl);

  if (linkedCareersUrl) {
    return linkedCareersUrl;
  }

  for (const path of COMMON_CAREERS_PATHS) {
    const candidateUrl = new URL(path, homepageUrl).toString();

    try {
      const result = await fetchHtmlDocument(candidateUrl, { retries: 0 });
      const normalized = normalizeUrl(result.url);

      if (normalized && isCareersPage(result.html, normalized)) {
        return normalized;
      }
    } catch {
      // A missing common path is expected; try the next bounded fallback.
    }
  }

  return null;
}
