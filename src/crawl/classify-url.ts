import { isCareersPage } from "../services/careers.js";

export type CrawlUrlType = "shopify-directory" | "careers-page" | "website";

export function classifyCrawlUrl(url: string, html: string): CrawlUrlType {
  const parsed = new URL(url);

  if (
    /(^|\.)shopify\.com$/i.test(parsed.hostname) &&
    parsed.pathname.includes("/partners/directory")
  ) {
    return "shopify-directory";
  }

  return isCareersPage(html, url) ? "careers-page" : "website";
}
