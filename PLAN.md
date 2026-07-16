# Agency Discovery Tool — MVP Plan

## 1. MVP scope

The MVP is a local, command-line workflow that builds a deduplicated database of Shopify-focused development agencies.

### Included

- Discover agency candidates from a small set of configurable public web sources and search queries.
- Capture the candidate name, source URL, and discovery evidence.
- Resolve and verify each agency's official website.
- Confirm Shopify relevance using clear website evidence, such as Shopify service pages, Shopify Partner references, case studies, or platform-specific copy.
- Find the agency's careers or jobs page when one is publicly linked or discoverable on the official domain.
- Detect a known applicant tracking system (ATS) from careers-page URLs, links, embeds, redirects, and page markup.
- Normalize domains and URLs, then merge duplicate agency records.
- Persist results and discovery state in a local SQLite database through Prisma.
- Produce structured logs and a simple CLI summary of the run.
- Allow interrupted runs to resume safely without recreating completed work.

### Excluded

- Dashboard or other graphical interface.
- Authentication, user accounts, or multi-user support.
- Notifications, email, Slack, or scheduled alerts.
- Scraping or storing individual job listings.
- Applying to jobs or contacting agencies.
- Cloud deployment or hosted database infrastructure.
- General-purpose agency enrichment unrelated to discovery and careers verification.

## 2. Architecture

Use a single Node.js/TypeScript application with a small pipeline of independently testable services. A CLI command coordinates the pipeline; SQLite is the source of truth.

### Main components

1. **CLI/orchestrator**
   - Parses a small set of run options, starts a run, and invokes pipeline stages in order.
   - Supports running the full pipeline or a selected stage for recovery and debugging.

2. **Discovery adapters**
   - Convert source-specific pages or search results into a common candidate shape.
   - Store source attribution and evidence before verification.
   - Keep sources configurable so a blocked source can be disabled without changing the pipeline.

3. **HTTP fetcher**
   - Uses normal HTTP requests for static pages and Cheerio for parsing.
   - Applies timeouts, limited retries, rate limiting, response-size limits, and a descriptive user agent.

4. **Browser fetcher**
   - Uses Playwright only when JavaScript rendering, browser navigation, or redirect inspection is necessary.
   - Acts as a fallback rather than the default fetch path to keep runs fast and inexpensive.

5. **Verification and enrichment services**
   - Determine the official website from source evidence and domain signals.
   - Score Shopify relevance and retain human-readable evidence.
   - Locate careers pages from navigation/footer links, common paths, and targeted same-domain inspection.
   - Detect ATS providers using a registry of known hostnames and URL/markup signatures.

6. **Normalization and deduplication**
   - Canonicalize URLs and registrable domains.
   - Match primarily on canonical domain, with normalized name and redirect destination as secondary signals.
   - Merge evidence conservatively and retain the most complete verified values.

7. **Persistence**
   - Prisma provides typed access to a local SQLite database.
   - Status and timestamps make each stage idempotent and resumable.

8. **Validation and logging**
   - Zod validates configuration, adapter output, parsed URLs, and service boundaries.
   - Pino emits structured logs with agency ID, domain, stage, duration, and error context.

## 3. Data flow

```text
Configured discovery sources/queries
              |
              v
      Raw candidate extraction
              |
              v
   Zod validation + URL normalization
              |
              v
     Preliminary deduplication
              |
              v
     Official website resolution
              |
              v
 Shopify-focus verification + evidence
              |
              v
        Careers page discovery
              |
              v
          ATS detection
              |
              v
 Final domain-based deduplication/merge
              |
              v
        SQLite via Prisma
              |
              v
      CLI run summary + Pino logs
```

Each stage reads records eligible for that stage, writes its result and status transactionally, and records failures without stopping unrelated candidates. Re-running a stage skips completed records unless a force option is explicitly used.

## 4. Folder structure

```text
.
├── PLAN.md
├── package.json
├── tsconfig.json
├── .env.example
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── cli.ts
│   ├── config.ts
│   ├── logger.ts
│   ├── db.ts
│   ├── types.ts
│   ├── discovery/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── sources/
│   ├── fetch/
│   │   ├── http.ts
│   │   └── browser.ts
│   ├── pipeline/
│   │   ├── discover.ts
│   │   ├── verify-website.ts
│   │   ├── verify-shopify.ts
│   │   ├── find-careers.ts
│   │   ├── detect-ats.ts
│   │   └── deduplicate.ts
│   ├── services/
│   │   ├── ats-registry.ts
│   │   └── evidence.ts
│   └── utils/
│       ├── domain.ts
│       ├── url.ts
│       └── retry.ts
├── tests/
│   ├── fixtures/
│   ├── unit/
│   └── integration/
└── data/
    └── .gitkeep
```

The structure may begin with fewer files and grow into this layout as phases are implemented. Source adapters should only be added when a real discovery source is selected.

## 5. Prisma Agency model

The MVP can use one agency table. Discovery evidence and errors are stored as JSON strings because SQLite support through Prisma does not provide a native `Json` field. `discoverySource` identifies the first source; `sourceUrls` preserves all known source URLs after merges.

```prisma
enum DiscoveryStatus {
  DISCOVERED
  WEBSITE_VERIFIED
  SHOPIFY_VERIFIED
  CAREERS_CHECKED
  COMPLETE
  REJECTED
  FAILED
}

model Agency {
  id                 Int             @id @default(autoincrement())
  name               String
  normalizedName     String
  websiteUrl         String?
  canonicalDomain    String?         @unique
  careersUrl         String?
  atsProvider        String?
  atsUrl              String?
  isShopifyFocused   Boolean?
  shopifyEvidence    String?
  discoverySource    String
  sourceUrls         String
  status              DiscoveryStatus @default(DISCOVERED)
  rejectionReason    String?
  lastError           String?
  attemptCount        Int             @default(0)
  discoveredAt       DateTime        @default(now())
  websiteVerifiedAt  DateTime?
  shopifyVerifiedAt  DateTime?
  careersCheckedAt   DateTime?
  completedAt        DateTime?
  lastAttemptedAt    DateTime?
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  @@index([status])
  @@index([normalizedName])
  @@index([atsProvider])
}
```

Model rules:

- `canonicalDomain` is the primary durable deduplication key and excludes protocol, path, leading `www`, and tracking parameters.
- An unresolved candidate may temporarily have a null domain; name/source matching prevents obvious duplicates until verification.
- `sourceUrls` and `shopifyEvidence` contain JSON-encoded arrays or objects validated by Zod at application boundaries.
- A missing careers page or ATS is a valid checked result, not an error.
- If provenance becomes too complex for JSON strings, a separate `AgencySource` model is a post-MVP migration, not an MVP requirement.

## 6. Discovery statuses

| Status | Meaning | Next action |
| --- | --- | --- |
| `DISCOVERED` | Candidate was found and minimally validated. | Resolve and verify the official website. |
| `WEBSITE_VERIFIED` | Official website and canonical domain were confirmed. | Verify Shopify focus. |
| `SHOPIFY_VERIFIED` | The website contains sufficient Shopify-specific evidence. | Find and inspect the careers page. |
| `CAREERS_CHECKED` | Careers discovery and ATS detection were attempted; null results are allowed. | Perform final merge and completeness checks. |
| `COMPLETE` | Required MVP fields and checks are finished. | No action unless explicitly refreshed. |
| `REJECTED` | Candidate is not an agency, is not Shopify-focused, or has no safely verifiable official site. | Retain the reason and do not retry automatically. |
| `FAILED` | A transient or unexpected error exhausted the retry limit. | Retry in a later run or inspect `lastError`. |

Statuses represent the furthest successfully completed stage. A stage writes its status only after its data has been persisted. Rejections are terminal but auditable; failures are retryable.

## 7. Implementation phases

### Phase 1 — Project foundation

- Initialize Node.js, TypeScript, `tsx`, lint/type-check scripts, configuration validation, and Pino logging.
- Add Prisma with SQLite, the `Agency` model, and the first migration.
- Add URL/domain normalization utilities and unit tests.

### Phase 2 — Candidate discovery

- Define the common discovery adapter contract and validated candidate schema.
- Implement one or two stable, public discovery sources or query inputs.
- Persist candidates idempotently with source evidence and preliminary name/URL deduplication.

### Phase 3 — Official website and Shopify verification

- Implement bounded HTTP fetching with Playwright fallback.
- Resolve redirects and canonical domains.
- Verify official-site confidence and Shopify relevance using explicit, stored evidence.
- Reject ambiguous or irrelevant candidates with reasons.

### Phase 4 — Careers and ATS detection

- Find careers links from the verified website and a short list of common paths.
- Follow redirects and inspect rendered pages only when necessary.
- Add a data-driven registry for common ATS providers and store provider evidence/URL.
- Treat “checked but not found” as a successful outcome.

### Phase 5 — Deduplication and resilience

- Merge records by canonical domain and redirect destination, with normalized names as supporting evidence.
- Make stages resumable and idempotent.
- Add retry limits, rate limiting, timeouts, error classification, and fixture-based integration tests.

### Phase 6 — MVP validation

- Run the complete pipeline against a small representative sample.
- Manually review a sample of accepted, rejected, careers-found, and ATS-detected records.
- Document local setup, commands, configuration, database location, and known limitations.

## 8. MVP completion criteria

The MVP is complete when:

- A single documented CLI command can run the full local pipeline.
- At least one real discovery adapter produces agency candidates with source provenance.
- Every accepted record has a verified official website, canonical domain, and stored Shopify-focus evidence.
- Every Shopify-verified agency has had careers discovery attempted, including a recorded null result when no page is found.
- Known ATS providers are detected from fixtures and representative live pages; unknown or custom careers systems remain null without failing the record.
- Duplicate candidates resolving to the same canonical domain produce one agency record with combined provenance.
- The SQLite database persists results across runs, and a second run does not duplicate completed agencies.
- Transient failures are bounded, logged, and retryable without restarting the entire pipeline.
- Unit tests cover normalization, deduplication rules, Shopify evidence classification, careers-link selection, and ATS signatures.
- A manually reviewed sample meets an agreed baseline of at least 90% correct official-domain matches and 90% correct Shopify relevance decisions. This is a validation target, not a claim of exhaustive discovery.
- No excluded features—dashboard, authentication, notifications, or job scraping—have been introduced.

## 9. Risks and fallback strategies

| Risk | Impact | Fallback strategy |
| --- | --- | --- |
| Discovery source changes, blocks automation, or has restrictive terms | Candidate volume drops or an adapter breaks. | Keep adapters isolated and configurable; disable the source, use another permitted public source, or accept seed URLs from a local file. Respect robots directives and site terms. |
| Search results identify the wrong official website | Incorrect domain causes bad enrichment and merging. | Require multiple signals such as name, branding, contact details, and source links; reject ambiguous candidates for later review rather than guessing. |
| JavaScript-heavy or anti-bot pages | Static fetches miss content or receive challenges. | Use Playwright as a bounded fallback; persist the failure and continue. Do not attempt to bypass CAPTCHAs or access controls. |
| Shopify relevance is ambiguous | False positives include generic agencies; false negatives omit valid agencies. | Store evidence and use conservative, explainable rules. Prefer platform-specific service pages/case studies over isolated keyword mentions; leave uncertain candidates rejected with a reason for review. |
| Careers pages use unusual labels or are not linked | Careers URL is missed. | Check navigation/footer anchors, a small list of common paths, search-engine/source hints where permitted, and same-domain links. Record a successful null after bounded attempts. |
| ATS provider is unknown, embedded, or proxied | Provider remains unidentified. | Keep ATS signatures in a data-driven registry; store the careers URL and set provider to null so new signatures can be added later without rediscovery. |
| Domain normalization merges distinct agencies or fails to merge aliases | Data loss or duplicates. | Use registrable-domain parsing, redirect evidence, and conservative merge rules; log merges and preserve all source URLs. Avoid automatic name-only merges. |
| SQLite write contention | Concurrent workers fail or lock the database. | Start with low concurrency and short transactions; enable WAL mode if needed. A queue or server database is deferred until scale justifies it. |
| Long or unbounded crawls | Runs become slow and place excess load on sites. | Enforce per-domain page limits, response-size limits, timeouts, rate limits, and maximum retries. Crawl only pages needed for the current stage. |
| Stored page content creates privacy or maintenance burden | Database grows and retains unnecessary data. | Store URLs, structured evidence snippets, and timestamps—not full page bodies or personal data. Use temporary HTML only for parsing/debugging when necessary. |
| Live-site tests become flaky | CI or local verification is unreliable. | Test parsers against checked-in, sanitized fixtures; reserve live checks for a small manual validation run. |
