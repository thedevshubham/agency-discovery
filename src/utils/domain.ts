import { getDomain } from "tldts";

import { parseHttpUrl } from "./url.js";

export function normalizeHostname(hostname: string): string | null {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  const withoutWww = normalized.replace(/^www\d*\./, "");

  return withoutWww || null;
}

export function getCanonicalDomain(input: string): string | null {
  const url = parseHttpUrl(input);

  if (!url) {
    return null;
  }

  const hostname = normalizeHostname(url.hostname);

  if (!hostname) {
    return null;
  }

  return getDomain(hostname, { allowPrivateDomains: true }) ?? hostname;
}

export function haveSameCanonicalDomain(
  firstUrl: string,
  secondUrl: string,
): boolean {
  const firstDomain = getCanonicalDomain(firstUrl);
  const secondDomain = getCanonicalDomain(secondUrl);

  return firstDomain !== null && firstDomain === secondDomain;
}
