const TARGET_ROLE_PATTERN =
  /\b(front[ -]?end|web developer|shopify developer|ui developer|react developer|javascript developer|typescript developer|software engineer|software developer)\b/i;
const EXCLUDED_ROLE_PATTERN =
  /\b(back[ -]?end|designer|marketing|sales|business development|content|writer|seo|human resources|hr|qa|quality assurance|project manager)\b/i;

export function isRelevantJobRole(title: string): boolean {
  return TARGET_ROLE_PATTERN.test(title) && !EXCLUDED_ROLE_PATTERN.test(title);
}

export function isLikelyJobPageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return !/\/(?:contact|contact-us|pages\/contact)\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}
