import { JobStatus } from "@prisma/client";

import { db } from "../db.js";
import { scoreJobForResume } from "../matching/score.js";

export type JobMatchingSummary = {
  resumeId: number;
  jobsScored: number;
  highestScore: number;
};

export type JobMatchingOptions = {
  onJob?: (progress: {
    processed: number;
    total: number;
    title: string;
    score: number;
  }) => void;
};

export async function matchJobs(
  options: JobMatchingOptions = {},
): Promise<JobMatchingSummary> {
  const resume = await db.resume.findFirst({
    where: { isActive: true },
    orderBy: { importedAt: "desc" },
  });

  if (!resume) {
    throw new Error("No active resume found. Run import-resume first.");
  }

  const jobs = await db.job.findMany({
    where: { status: JobStatus.ACTIVE },
    select: { id: true, title: true, description: true },
  });
  let highestScore = 0;
  let processed = 0;

  for (const job of jobs) {
    const result = scoreJobForResume(resume.rawText, job);
    highestScore = Math.max(highestScore, result.score);

    await db.jobMatch.upsert({
      where: { resumeId_jobId: { resumeId: resume.id, jobId: job.id } },
      create: {
        resumeId: resume.id,
        jobId: job.id,
        score: result.score,
        titleScore: result.titleScore,
        skillScore: result.skillScore,
        matchedTerms: JSON.stringify(result.matchedTerms),
        missingTerms: JSON.stringify(result.missingTerms),
      },
      update: {
        score: result.score,
        titleScore: result.titleScore,
        skillScore: result.skillScore,
        matchedTerms: JSON.stringify(result.matchedTerms),
        missingTerms: JSON.stringify(result.missingTerms),
        calculatedAt: new Date(),
      },
    });

    processed += 1;
    options.onJob?.({
      processed,
      total: jobs.length,
      title: job.title,
      score: result.score,
    });
  }

  return { resumeId: resume.id, jobsScored: jobs.length, highestScore };
}

export async function listJobMatches(limit?: number) {
  const resume = await db.resume.findFirst({
    where: { isActive: true },
    orderBy: { importedAt: "desc" },
  });

  if (!resume) {
    throw new Error("No active resume found. Run import-resume first.");
  }

  const matches = await db.jobMatch.findMany({
    where: {
      resumeId: resume.id,
      job: { status: JobStatus.ACTIVE },
    },
    orderBy: [{ score: "desc" }, { job: { title: "asc" } }],
    include: {
      job: { include: { agency: true } },
    },
  });

  return limit ? matches.slice(0, limit) : matches;
}
