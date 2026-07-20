# Plan

## MVP scope

The MVP accepts a directory, company, or careers URL; discovers current job listings; stores one active PDF resume; calculates deterministic match scores; and lists relevant jobs locally. It does not submit applications, handle logins, solve CAPTCHAs, scrape individual job applications, or provide a dashboard.

## Architecture

```text
CLI → URL classifier → source adapter / website crawler → careers discovery
                                                    ↓
SQLite ← Prisma ← authoritative job synchronization ← job parser
   ↓
resume PDF → text extraction → scoring → matched-job listing
```

## Data flow

1. Validate the URL and required count or `--all`.
2. Discover directory profiles or identify a company/careers page.
3. Find and fetch careers pages.
4. Parse current job listings.
5. Create/update present jobs and delete missing jobs after successful full crawls.
6. Import or update one active resume.
7. Score current jobs and persist `JobMatch` records.
8. List ranked matches with evidence and URLs.

## Commands

```text
crawl <url> <count|--all>
resume upload <file.pdf>
resume update <file.pdf>
resume status
match <count|--all>
jobs <count|--all>
status
```

## Data model

- `Agency`: source, official website, careers URL, and crawl state.
- `Job`: current job identity, metadata, source URL, and timestamps.
- `Resume`: local PDF metadata, extracted text, and active flag.
- `JobMatch`: score components and matched/missing terms per resume and job.

## Completion criteria

- A supplied URL can be classified and crawled.
- Career pages and job URLs are persisted without duplicates.
- Successful full recrawls delete jobs that disappeared.
- Failed or limited crawls do not delete unseen jobs.
- A PDF resume can be uploaded, inspected, and explicitly replaced.
- Current jobs can be scored and listed with a mandatory count or `--all`.
- Progress and summaries are logged.
- TypeScript and tests pass.

## Risks and fallbacks

- Dynamic pages may require a Playwright-backed source adapter.
- Weak page markup can create false jobs; parsers require fixtures and tighter rules.
- Directory pagination can change; adapters must detect termination dynamically.
- A zero-result successful parse may reflect markup drift; crawl summaries make deletions visible.
- Network failures preserve existing jobs and record the error.
