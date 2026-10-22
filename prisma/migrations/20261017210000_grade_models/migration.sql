-- CreateTable
CREATE TABLE "gradeList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "gradingSystemId" TEXT NOT NULL,
    "gradingSystemLockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "gradeList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gradeListId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "subject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "subject_gradeListId_userId_fkey" FOREIGN KEY ("gradeListId", "userId") REFERENCES "gradeList" ("id", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "gradeType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "gradeType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "gradeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gradeListId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "gradeTypeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "grade" REAL,
    "weight" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "gradeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "gradeEntry_gradeListId_userId_fkey" FOREIGN KEY ("gradeListId", "userId") REFERENCES "gradeList" ("id", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "gradeEntry_subjectId_gradeListId_userId_fkey" FOREIGN KEY ("subjectId", "gradeListId", "userId") REFERENCES "subject" ("id", "gradeListId", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "gradeEntry_gradeTypeId_userId_fkey" FOREIGN KEY ("gradeTypeId", "userId") REFERENCES "gradeType" ("id", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gradeEntryId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "attachment_gradeEntryId_userId_fkey" FOREIGN KEY ("gradeEntryId", "userId") REFERENCES "gradeEntry" ("id", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "dashboardPreference" (
    "userId" TEXT NOT NULL,
    "gradeListId" TEXT NOT NULL,
    "showOnDashboard" BOOLEAN NOT NULL DEFAULT true,
    "includeInOverall" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("gradeListId", "userId"),
    CONSTRAINT "dashboardPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "dashboardPreference_gradeListId_userId_fkey" FOREIGN KEY ("gradeListId", "userId") REFERENCES "gradeList" ("id", "userId") ON DELETE CASCADE ON UPDATE RESTRICT
);

-- CreateIndex
CREATE INDEX "gradeList_userId_status_idx" ON "gradeList"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "gradeList_id_userId_key" ON "gradeList"("id", "userId");

-- CreateIndex
CREATE INDEX "subject_userId_gradeListId_idx" ON "subject"("userId", "gradeListId");

-- CreateIndex
CREATE UNIQUE INDEX "subject_id_gradeListId_userId_key" ON "subject"("id", "gradeListId", "userId");

-- CreateIndex
CREATE INDEX "gradeType_userId_idx" ON "gradeType"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "gradeType_id_userId_key" ON "gradeType"("id", "userId");

-- CreateIndex
CREATE INDEX "gradeEntry_userId_date_idx" ON "gradeEntry"("userId", "date");

-- CreateIndex
CREATE INDEX "gradeEntry_userId_gradeListId_date_idx" ON "gradeEntry"("userId", "gradeListId", "date");

-- CreateIndex
CREATE INDEX "gradeEntry_userId_subjectId_date_idx" ON "gradeEntry"("userId", "subjectId", "date");

-- CreateIndex
CREATE INDEX "gradeEntry_userId_gradeTypeId_idx" ON "gradeEntry"("userId", "gradeTypeId");

-- CreateIndex
CREATE INDEX "gradeEntry_userId_createdAt_idx" ON "gradeEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "gradeEntry_id_userId_key" ON "gradeEntry"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "attachment_storageName_key" ON "attachment"("storageName");

-- CreateIndex
CREATE INDEX "attachment_userId_gradeEntryId_idx" ON "attachment"("userId", "gradeEntryId");

-- CreateIndex
CREATE INDEX "dashboardPreference_userId_idx" ON "dashboardPreference"("userId");
