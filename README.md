# Agency Job Discovery

A local TypeScript CLI for discovering agency career pages and jobs, storing an active resume, scoring current jobs, and listing the best matches.

```text
URL → careers page → current jobs → active resume → scored matches
```

There is no job-application automation.

## Setup

```bash
nvm use
npm install
cp .env.example .env
npm run db:migrate
```

SQLite is embedded, so no database server is required.

## Commands

Collection-processing commands require a positive number or `--all`.

Quick reference:

```bash
npm run dev -- crawl "<url>" 50
npm run dev -- crawl "<url>" --all

npm run dev -- resume upload "./resume.pdf"
npm run dev -- resume update "./new-resume.pdf"
npm run dev -- resume status

npm run dev -- match 10
npm run dev -- match --all

npm run dev -- jobs 10
npm run dev -- jobs --all

npm run dev -- status
```

### Crawl

Shopify directory:

```bash
npm run dev -- crawl "https://www.shopify.com/in/partners/directory" 50
```

Company website or careers page:

```bash
npm run dev -- crawl "https://company.example" --all
npm run dev -- crawl "https://company.example/careers" --all
```

For every careers page fetched successfully, the discovered list becomes authoritative. Jobs missing from the latest full-page crawl are deleted from SQLite. A failed fetch preserves existing jobs. A numeric job limit on a direct careers page does not delete unseen jobs because the result was intentionally truncated.

### Resume

```bash
npm run dev -- resume upload "./data/resume.pdf"
npm run dev -- resume status
npm run dev -- resume update "./data/new-resume.pdf"
```

Only one resume is active. Resume commands use a file path rather than a count.

### Calculate matches

```bash
npm run dev -- match 10
npm run dev -- match --all
```

This recalculates scores for all current jobs and prints the requested number of relevant results.

### List stored matches

```bash
npm run dev -- jobs 10
npm run dev -- jobs --all
```

This is read-only and does not recalculate scores. It lists every stored score record up to the requested count, including low and zero scores. Results contain total score, title score, skill score, a `relevant` flag, matched terms, missing terms, agency, location, and job URL.

### Status

```bash
npm run dev -- status
```

## Freshness behavior

```text
successful full careers crawl
        │
        ├── create newly listed jobs
        ├── update jobs still listed
        └── delete jobs no longer listed

failed or intentionally limited crawl
        └── preserve unseen existing jobs
```

`JobMatch` rows cascade-delete when their job is deleted. Run `match` after crawling to refresh scores for new and updated jobs.

## Validation

```bash
npm run typecheck
npm test
```

## Structure

```text
src/
├── cli.ts
├── crawl/                 # URL classification and orchestration
├── discovery/sources/     # Directory adapters
├── services/careers.ts    # Careers-page discovery
├── jobs/                  # Job extraction and identity
├── resumes/               # PDF import and active resume
├── matching/              # Scoring and eligibility
├── pipeline/              # Discovery, enrichment, job sync, matching
└── progress.ts
```
