import { db } from "./db.js";
import { loadCandidatesFromJson } from "./discovery/sources/local-json.js";
import { discoverShopifyPartners } from "./discovery/sources/shopify-directory.js";
import { logger } from "./logger.js";
import { discoverCandidates } from "./pipeline/discover.js";
import { enrichAgencies } from "./pipeline/enrich.js";

async function showStatus(): Promise<void> {
  const agencyCount = await db.agency.count();

  logger.info({ agencyCount }, "Agency discovery database is ready");
}

async function runDiscovery(filePath: string | undefined): Promise<void> {
  if (!filePath) {
    throw new Error("Usage: npm run dev -- discover <path-to-candidates.json>");
  }

  const candidates = await loadCandidatesFromJson(filePath);
  const summary = await discoverCandidates(candidates);

  logger.info(summary, "Candidate discovery completed");
}

async function runShopifyDiscovery(maxPagesValue: string | undefined): Promise<void> {
  const maxPages = maxPagesValue ? Number.parseInt(maxPagesValue, 10) : undefined;

  if (maxPagesValue && (!Number.isInteger(maxPages) || (maxPages ?? 0) < 1)) {
    throw new Error("max-pages must be a positive integer");
  }

  const candidates = await discoverShopifyPartners({
    ...(maxPages ? { maxPages } : {}),
    onPage: ({ page, discovered, totalPages }) => {
      logger.info(
        { page, totalPages, discovered },
        "Shopify directory page processed",
      );
    },
  });
  const summary = await discoverCandidates(candidates);

  logger.info(summary, "Shopify Partner Directory discovery completed");
}

async function runEnrichment(limitValue: string | undefined): Promise<void> {
  const effectiveLimitValue = limitValue ?? "25";
  const limit =
    effectiveLimitValue.toLowerCase() === "all"
      ? undefined
      : Number.parseInt(effectiveLimitValue, 10);

  if (
    effectiveLimitValue.toLowerCase() !== "all" &&
    (!Number.isInteger(limit) || (limit ?? 0) < 1)
  ) {
    throw new Error("limit must be a positive integer or 'all'");
  }

  const summary = await enrichAgencies({
    ...(limit ? { limit } : {}),
    onAgency: ({ agencyId, name, processed, total }) => {
      logger.info(
        { agencyId, name, processed, total },
        "Agency enrichment processed",
      );
    },
  });

  logger.info(summary, "Homepage and careers enrichment completed");
}

async function main(): Promise<void> {
  const [command = "status", argument] = process.argv.slice(2);

  switch (command) {
    case "status":
      await showStatus();
      break;
    case "discover":
      await runDiscovery(argument);
      break;
    case "discover-shopify":
      await runShopifyDiscovery(argument);
      break;
    case "enrich":
      await runEnrichment(argument);
      break;
    default:
      throw new Error(
        `Unknown command: ${command}. Available commands: status, discover, discover-shopify, enrich`,
      );
  }
}

main()
  .catch((error: unknown) => {
    logger.error({ error }, "Command failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
