-- CreateTable
CREATE TABLE "Resume" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileName" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Resume_contentHash_key" ON "Resume"("contentHash");

-- CreateIndex
CREATE INDEX "Resume_isActive_idx" ON "Resume"("isActive");
