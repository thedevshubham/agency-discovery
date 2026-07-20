import { parseRequiredLimit } from "./cli/arguments.js";
import { crawlUrl, type CrawlLimit } from "./crawl/pipeline.js";
import { db } from "./db.js";
import { logger } from "./logger.js";
import {
  isLikelyJobPageUrl,
  isRelevantJobRole,
} from "./matching/eligibility.js";
import { listJobMatches, matchJobs } from "./pipeline/match-jobs.js";
import { reportProgress } from "./progress.js";
import {
  getActiveResume,
  updateResume,
  uploadResume,
} from "./resumes/service.js";

type RequiredLimit = number | "all";

async function showStatus(): Promise<void> {
  const [agencyCount, jobCount, activeResumeCount, jobMatchCount] =
    await Promise.all([
      db.agency.count(),
      db.job.count(),
      db.resume.count({ where: { isActive: true } }),
      db.jobMatch.count(),
    ]);

  logger.info(
    { agencyCount, jobCount, activeResumeCount, jobMatchCount },
    "Local workflow status",
  );
}

async function runCrawl(arguments_: string[]): Promise<void> {
  const [url, countValue] = arguments_;
  if (!url) throw new Error("Usage: npm run dev -- crawl <url> <count|--all>");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Invalid crawl URL: ${url}`);
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Crawl URL must use HTTP or HTTPS");
  }

  const limit = parseRequiredLimit(
    countValue,
    "npm run dev -- crawl <url> <count|--all>",
  ) as CrawlLimit;
  logger.info({ url: parsedUrl.toString(), limit }, "Crawl started");
  logger.info(await crawlUrl(parsedUrl.toString(), limit), "Crawl completed");
}

async function runResume(arguments_: string[]): Promise<void> {
  const [action, filePath] = arguments_;
  if (action === "status") {
    const resume = await getActiveResume();
    logger.info(resume ? { resume } : {}, resume ? "Active resume" : "No active resume");
    return;
  }
  if (action === "upload" || action === "update") {
    if (!filePath) {
      throw new Error(`Usage: npm run dev -- resume ${action} <file.pdf>`);
    }
    const resume = action === "upload"
      ? await uploadResume(filePath)
      : await updateResume(filePath);
    logger.info(resume, action === "upload" ? "Resume uploaded" : "Active resume updated");
    return;
  }
  throw new Error("Usage: npm run dev -- resume <upload|status|update> [file.pdf]");
}

async function printMatches(requested: RequiredLimit): Promise<number> {
  const matches = await listJobMatches(requested === "all" ? undefined : requested);
  matches.forEach((match, index) =>
    logger.info(
      {
        rank: index + 1,
        score: match.score,
        titleScore: match.titleScore,
        skillScore: match.skillScore,
        title: match.job.title,
        agency: match.job.agency.name,
        location: match.job.location,
        relevant:
          match.score >= 60 &&
          isRelevantJobRole(match.job.title) &&
          isLikelyJobPageUrl(match.job.jobUrl),
        matchedTerms: JSON.parse(match.matchedTerms) as string[],
        missingTerms: JSON.parse(match.missingTerms) as string[],
        jobUrl: match.job.jobUrl,
      },
      "Matched job",
    ),
  );
  return matches.length;
}

async function runMatch(arguments_: string[]): Promise<void> {
  const requested = parseRequiredLimit(
    arguments_[0],
    "npm run dev -- match <count|--all>",
  );
  const summary = await matchJobs({
    onJob: ({ processed, total, title, score }) =>
      reportProgress("match", processed, total, "Job scored", { title, score }),
  });
  const returned = await printMatches(requested);
  logger.info({ ...summary, requested, returned }, "Matching completed");
}

async function runJobs(arguments_: string[]): Promise<void> {
  const requested = parseRequiredLimit(
    arguments_[0],
    "npm run dev -- jobs <count|--all>",
  );
  const returned = await printMatches(requested);
  logger.info({ requested, returned }, "Stored matched jobs listed");
}

async function main(): Promise<void> {
  const [command, ...arguments_] = process.argv.slice(2);
  switch (command) {
    case "crawl":
      await runCrawl(arguments_);
      break;
    case "resume":
      await runResume(arguments_);
      break;
    case "match":
      await runMatch(arguments_);
      break;
    case "jobs":
      await runJobs(arguments_);
      break;
    case "status":
      await showStatus();
      break;
    default:
      throw new Error("Usage: npm run dev -- <crawl|resume|match|jobs|status> ...");
  }
}

main()
  .catch((error: unknown) => {
    logger.error({ err: error }, "Command failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
