-- CreateTable
CREATE TABLE "Agency" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "canonicalDomain" TEXT,
    "careersUrl" TEXT,
    "atsProvider" TEXT,
    "atsUrl" TEXT,
    "isShopifyFocused" BOOLEAN,
    "shopifyEvidence" TEXT,
    "discoverySource" TEXT NOT NULL,
    "sourceUrls" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "rejectionReason" TEXT,
    "lastError" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "websiteVerifiedAt" DATETIME,
    "shopifyVerifiedAt" DATETIME,
    "careersCheckedAt" DATETIME,
    "completedAt" DATETIME,
    "lastAttemptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Agency_canonicalDomain_key" ON "Agency"("canonicalDomain");

-- CreateIndex
CREATE INDEX "Agency_status_idx" ON "Agency"("status");

-- CreateIndex
CREATE INDEX "Agency_normalizedName_idx" ON "Agency"("normalizedName");

-- CreateIndex
CREATE INDEX "Agency_atsProvider_idx" ON "Agency"("atsProvider");
