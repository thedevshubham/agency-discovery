-- CreateTable
CREATE TABLE "JobMatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "resumeId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "titleScore" INTEGER NOT NULL,
    "skillScore" INTEGER NOT NULL,
    "matchedTerms" TEXT NOT NULL,
    "missingTerms" TEXT NOT NULL,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobMatch_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "JobMatch_resumeId_score_idx" ON "JobMatch"("resumeId", "score");

-- CreateIndex
CREATE INDEX "JobMatch_jobId_idx" ON "JobMatch"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JobMatch_resumeId_jobId_key" ON "JobMatch"("resumeId", "jobId");
