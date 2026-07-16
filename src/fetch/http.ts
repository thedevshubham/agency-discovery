const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 5_000_000;
const DEFAULT_RETRIES = 2;

export type FetchHtmlOptions = {
  timeoutMs?: number;
  maxResponseBytes?: number;
  retries?: number;
};

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchHtmlOnce(
  url: string,
  options: Required<FetchHtmlOptions>,
): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent":
        "AgencyDiscovery/0.1 (personal research tool; respectful crawling)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(options.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}: ${url}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("text/html")) {
    throw new Error(`Expected HTML but received ${contentType || "unknown content"}: ${url}`);
  }

  const declaredLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > options.maxResponseBytes) {
    throw new Error(`HTML response exceeds size limit: ${url}`);
  }

  const body = await response.arrayBuffer();

  if (body.byteLength > options.maxResponseBytes) {
    throw new Error(`HTML response exceeds size limit: ${url}`);
  }

  return new TextDecoder().decode(body);
}

export async function fetchHtml(
  url: string,
  options: FetchHtmlOptions = {},
): Promise<string> {
  const resolvedOptions: Required<FetchHtmlOptions> = {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxResponseBytes:
      options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
    retries: options.retries ?? DEFAULT_RETRIES,
  };
  let lastError: unknown;

  for (let attempt = 0; attempt <= resolvedOptions.retries; attempt += 1) {
    try {
      return await fetchHtmlOnce(url, resolvedOptions);
    } catch (error) {
      lastError = error;

      if (attempt < resolvedOptions.retries) {
        await delay(500 * 2 ** attempt);
      }
    }
  }

  throw new Error(`Unable to fetch HTML after retries: ${url}`, {
    cause: lastError,
  });
}
