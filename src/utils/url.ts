const TRACKING_PARAMETER_NAMES = new Set([
  "_ga",
  "dclid",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "msclkid",
]);

function hasScheme(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(value);
}

export function parseHttpUrl(input: string): URL | null {
  const value = input.trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(hasScheme(value) ? value : `https://${value}`);

    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function isTrackingParameter(name: string): boolean {
  const normalizedName = name.toLowerCase();

  return (
    normalizedName.startsWith("utm_") ||
    TRACKING_PARAMETER_NAMES.has(normalizedName)
  );
}

export function normalizeUrl(input: string): string | null {
  const url = parseHttpUrl(input);

  if (!url) {
    return null;
  }

  url.hash = "";

  for (const name of [...url.searchParams.keys()]) {
    if (isTrackingParameter(name)) {
      url.searchParams.delete(name);
    }
  }

  url.searchParams.sort();

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  const normalized = url.toString();

  return url.pathname === "/" && !url.search
    ? normalized.replace(/\/$/, "")
    : normalized;
}
