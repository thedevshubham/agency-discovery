import { load } from "cheerio";

import { fetchHtml } from "../../fetch/http.js";
import { candidateListSchema, type AgencyCandidate } from "../types.js";

export const SHOPIFY_DIRECTORY_URL =
  "https://www.shopify.com/in/partners/directory/services";

const SHOPIFY_ORIGIN = "https://www.shopify.com";
const DEFAULT_PAGE_DELAY_MS = 500;

export type ShopifyDirectoryPage = {
  candidates: AgencyCandidate[];
  totalPartners: number | null;
};

export type ShopifyDiscoveryOptions = {
  maxPages?: number;
  pageDelayMs?: number;
  onPage?: (progress: {
    page: number;
    totalPages: number | null;
    discovered: number;
  }) => void;
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function buildPageUrl(page: number): string {
  const url = new URL(SHOPIFY_DIRECTORY_URL);

  if (page > 1) {
    url.searchParams.set("page", String(page));
  }

  return url.toString();
}

export function parseShopifyDirectoryPage(
  html: string,
): ShopifyDirectoryPage {
  const $ = load(html);
  const rawCandidates: unknown[] = [];

  $(
    '[data-component-name="listing-profile-card"] > a[href*="/partners/directory/partner/"], [name="listing-profile-card"] > a[href*="/partners/directory/partner/"]',
  ).each(
    (_, element) => {
      const href = $(element).attr("href");
      const name = $(element).find("h3").first().text().trim();

      if (!href || !name) {
        return;
      }

      const profileUrl = new URL(href, SHOPIFY_ORIGIN).toString();

      rawCandidates.push({
        name,
        sourceUrl: profileUrl,
        discoverySource: "shopify-partner-directory",
        evidence: "Official listing in the Shopify Partner Directory.",
      });
    },
  );

  const pageText = $("body").text().replace(/\s+/g, " ");
  const totalMatch = pageText.match(
    /(?:Showing\s+)?\d+\s*-\s*\d+\s+of\s+([\d,]+)\s*partners/i,
  );
  const totalPartners = totalMatch?.[1]
    ? Number.parseInt(totalMatch[1].replace(/,/g, ""), 10)
    : null;

  return {
    candidates: candidateListSchema.parse(rawCandidates),
    totalPartners,
  };
}

export async function discoverShopifyPartners(
  options: ShopifyDiscoveryOptions = {},
): Promise<AgencyCandidate[]> {
  const pageDelayMs = options.pageDelayMs ?? DEFAULT_PAGE_DELAY_MS;
  const candidatesByProfileUrl = new Map<string, AgencyCandidate>();
  let page = 1;
  let totalPages: number | null = null;

  while (!options.maxPages || page <= options.maxPages) {
    const html = await fetchHtml(buildPageUrl(page));
    const parsed = parseShopifyDirectoryPage(html);

    if (parsed.candidates.length === 0) {
      break;
    }

    if (page === 1 && parsed.totalPartners !== null) {
      totalPages = Math.ceil(parsed.totalPartners / parsed.candidates.length);
    }

    const countBeforePage = candidatesByProfileUrl.size;

    for (const candidate of parsed.candidates) {
      candidatesByProfileUrl.set(candidate.sourceUrl, candidate);
    }

    options.onPage?.({
      page,
      totalPages,
      discovered: candidatesByProfileUrl.size,
    });

    const addedOnPage = candidatesByProfileUrl.size - countBeforePage;

    if (addedOnPage === 0 || (totalPages !== null && page >= totalPages)) {
      break;
    }

    page += 1;

    if (pageDelayMs > 0) {
      await wait(pageDelayMs);
    }
  }

  return [...candidatesByProfileUrl.values()];
}
