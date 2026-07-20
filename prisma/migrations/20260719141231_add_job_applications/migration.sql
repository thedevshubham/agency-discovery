-- CreateTable
CREATE TABLE "JobApplication" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER NOT NULL,
    "resumeId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "matchScore" INTEGER NOT NULL,
    "applicationUrl" TEXT NOT NULL,
    "missingFields" TEXT NOT NULL DEFAULT '[]',
    "lastError" TEXT,
    "attemptedAt" DATETIME,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobApplication_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_jobId_key" ON "JobApplication"("jobId");

-- CreateIndex
CREATE INDEX "JobApplication_resumeId_idx" ON "JobApplication"("resumeId");

-- CreateIndex
CREATE INDEX "JobApplication_status_idx" ON "JobApplication"("status");
