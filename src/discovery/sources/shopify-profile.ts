import { load } from "cheerio";

import { normalizeUrl, parseHttpUrl } from "../../utils/url.js";

function isShopifyUrl(url: string): boolean {
  const hostname = parseHttpUrl(url)?.hostname.toLowerCase();

  return (
    hostname === "shopify.com" ||
    hostname?.endsWith(".shopify.com") === true ||
    hostname?.endsWith(".myshopify.com") === true
  );
}

export function extractOfficialWebsiteFromShopifyProfile(
  html: string,
): string | null {
  const $ = load(html);
  const contactHeading = $("p")
    .filter((_, element) =>
      /^contact information$/i.test($(element).text().trim()),
    )
    .first();

  if (contactHeading.length > 0) {
    const contactContainer = contactHeading.parent();

    for (const element of contactContainer.find('a[href^="http"]')) {
      const normalized = normalizeUrl($(element).attr("href") ?? "");

      if (normalized && !isShopifyUrl(normalized)) {
        return normalized;
      }
    }
  }

  for (const element of $('a[rel~="nofollow"][href^="http"]')) {
    const normalized = normalizeUrl($(element).attr("href") ?? "");

    if (normalized && !isShopifyUrl(normalized)) {
      return normalized;
    }
  }

  return null;
}
