import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

import { jobCandidateSchema, type JobCandidate } from "./types.js";
import { normalizeUrl } from "../utils/url.js";

const JOB_SIGNAL_PATTERN =
  /\b(apply(?:\s+now)?|view\s+(?:job|role|position)|job\s+details?|open\s+role)\b/i;
const GENERIC_LABEL_PATTERN =
  /^(apply(?:\s+now)?|view\s+(?:job|role|position)|job\s+details?|learn\s+more|open\s+positions?|explore\s+(?:jobs|careers|open\s+positions))$/i;
const NON_JOB_TITLE_PATTERN =
  /^(?:\d+\s+)?(?:open\s+roles?(?:\s+\(\d+\s+openings?\))?|openings?|careers?|jobs?|open\s+positions?|join\s+(?:us|our\s+team)|life\s+at|why\s+(?:join|work)|apply(?:\s+now)?(?:\s*button)?|the\s+team\s+of\s+.+)$/i;
const JOB_CONTEXT_PATTERN =
  /\b(experience|openings?|full[-\s]?time|part[-\s]?time|qualification|technology|location|remote|hybrid)\b/i;

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanTitle(value: string): string {
  return cleanText(value)
    .replace(/\s+\d+\s*(?:-|–|to)\s*\d+\+?\s*years?.*$/i, "")
    .replace(/\s+\d+\+?\s*years?\s+experience.*$/i, "")
    .replace(/\s+(?:apply(?:\s+now)?|view\s+(?:job|role|position)).*$/i, "")
    .trim();
}

function hasJobSignal($: CheerioAPI, link: Cheerio<AnyNode>): boolean {
  if (JOB_SIGNAL_PATTERN.test(cleanText(link.text()))) {
    return true;
  }

  return link
    .find("*")
    .toArray()
    .some((element) => JOB_SIGNAL_PATTERN.test(cleanText($(element).text())));
}

function findNearbyHeading(
  $: CheerioAPI,
  link: Cheerio<AnyNode>,
): string | null {
  let current = link.parent();

  for (let depth = 0; depth < 12 && current.length > 0; depth += 1) {
    const headings = current.find("h2, h3, h4, h5, h6");
    const context = cleanText(current.text());

    for (const heading of headings) {
      const title = cleanTitle($(heading).text());

      if (
        JOB_CONTEXT_PATTERN.test(context) &&
        context.length <= 1_500 &&
        title.length >= 2 &&
        title.length <= 120 &&
        !NON_JOB_TITLE_PATTERN.test(title)
      ) {
        return title;
      }
    }

    current = current.parent();
  }

  return null;
}

function createSyntheticJobUrl(careersUrl: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const url = new URL(careersUrl);
  url.searchParams.set("job", slug);

  return url.toString();
}

function resolveJobUrl(
  href: string,
  careersUrl: string,
  title: string,
): string | null {
  if (/^(mailto:|tel:|javascript:)/i.test(href.trim())) {
    return null;
  }

  try {
    const absolute = new URL(href, careersUrl);
    const careers = new URL(careersUrl);

    if (
      !href.trim() ||
      href.trim() === "#" ||
      (absolute.origin === careers.origin &&
        absolute.pathname === careers.pathname &&
        !absolute.search)
    ) {
      return createSyntheticJobUrl(careersUrl, title);
    }

    return normalizeUrl(absolute.toString());
  } catch {
    return null;
  }
}

function getDescription(link: Cheerio<AnyNode>, title: string): string | undefined {
  let current = link.parent();

  for (let depth = 0; depth < 4 && current.length > 0; depth += 1) {
    const text = cleanText(current.text());

    if (text.length > title.length + 10 && text.length <= 3_000) {
      return text;
    }

    current = current.parent();
  }

  return undefined;
}

export function parseGenericJobsPage(
  html: string,
  careersUrl: string,
): JobCandidate[] {
  const $ = load(html);
  const candidates = new Map<string, JobCandidate>();

  $("a[href]").each((_, element) => {
    const link = $(element);
    const linkText = cleanText(link.text());

    if (!hasJobSignal($, link)) {
      return;
    }

    const embeddedHeading = cleanTitle(
      link.find("h2, h3, h4, h5, h6").first().text(),
    );
    const titleFromLink = cleanTitle(linkText);
    const title =
      embeddedHeading.length >= 2 &&
      embeddedHeading.length <= 120 &&
      !NON_JOB_TITLE_PATTERN.test(embeddedHeading)
        ? embeddedHeading
        : titleFromLink.length >= 2 &&
      titleFromLink.length <= 120 &&
      !GENERIC_LABEL_PATTERN.test(titleFromLink)
        ? titleFromLink
        : findNearbyHeading($, link);

    if (!title || NON_JOB_TITLE_PATTERN.test(title)) {
      return;
    }

    const jobUrl = resolveJobUrl(link.attr("href") ?? "", careersUrl, title);

    if (!jobUrl) {
      return;
    }

    const parsed = jobCandidateSchema.safeParse({
      title,
      jobUrl,
      applicationUrl: jobUrl,
      description: getDescription(link, title),
      source: "generic-careers-page",
    });

    if (parsed.success) {
      candidates.set(`${parsed.data.jobUrl}:${parsed.data.title}`, parsed.data);
    }
  });

  return [...candidates.values()];
}
