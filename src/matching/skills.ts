const SKILL_ALIASES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["TypeScript", ["typescript"]],
  ["JavaScript", ["javascript"]],
  ["Node.js", ["node js", "nodejs"]],
  ["React", ["react", "reactjs", "react js"]],
  ["Next.js", ["next js", "nextjs"]],
  ["Vue", ["vue", "vuejs", "vue js"]],
  ["Angular", ["angular"]],
  ["Shopify", ["shopify"]],
  ["Liquid", ["liquid"]],
  ["HTML", ["html", "html5"]],
  ["CSS", ["css", "css3"]],
  ["GraphQL", ["graphql"]],
  ["REST API", ["rest api", "restful api"]],
  ["Prisma", ["prisma"]],
  ["SQLite", ["sqlite"]],
  ["MySQL", ["mysql"]],
  ["PostgreSQL", ["postgresql", "postgres"]],
  ["MongoDB", ["mongodb", "mongo db"]],
  ["Redis", ["redis"]],
  ["AWS", ["aws", "amazon web services"]],
  ["Azure", ["azure"]],
  ["GCP", ["gcp", "google cloud"]],
  ["Docker", ["docker"]],
  ["Kubernetes", ["kubernetes", "k8s"]],
  ["Git", ["git"]],
  ["Playwright", ["playwright"]],
  ["Jest", ["jest"]],
  ["Vitest", ["vitest"]],
  ["Python", ["python"]],
  ["Java", ["java"]],
  ["PHP", ["php"]],
  ["Laravel", ["laravel"]],
  ["Ruby", ["ruby"]],
  ["Rails", ["rails", "ruby on rails"]],
  ["Figma", ["figma"]],
  ["Flutter", ["flutter"]],
  ["Dart", ["dart"]],
  ["WordPress", ["wordpress", "word press"]],
  ["WooCommerce", ["woocommerce", "woo commerce"]],
  ["SEO", ["seo", "search engine optimization"]],
];

function searchableText(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

export function extractSkills(text: string): string[] {
  const searchable = searchableText(text);

  return SKILL_ALIASES.filter(([, aliases]) =>
    aliases.some((alias) => searchable.includes(searchableText(alias))),
  ).map(([skill]) => skill);
}
