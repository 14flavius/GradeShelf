-- CreateTable
CREATE TABLE "gradePeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gradeListId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "gradePeriod_gradeListId_userId_fkey" FOREIGN KEY ("gradeListId", "userId") REFERENCES "gradeList" ("id", "userId") ON DELETE CASCADE ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "subjectPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gradeListId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "enrolled" BOOLEAN NOT NULL DEFAULT true,
    "weightingMode" TEXT NOT NULL DEFAULT 'ENTRIES',
    "finalGrade" REAL,
    CONSTRAINT "subjectPeriod_subjectId_gradeListId_userId_fkey" FOREIGN KEY ("subjectId", "gradeListId", "userId") REFERENCES "subject" ("id", "gradeListId", "userId") ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT "subjectPeriod_periodId_gradeListId_userId_fkey" FOREIGN KEY ("periodId", "gradeListId", "userId") REFERENCES "gradePeriod" ("id", "gradeListId", "userId") ON DELETE CASCADE ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "subjectGradeType" (
    "subjectPeriodId" TEXT NOT NULL,
    "gradeTypeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "share" INTEGER NOT NULL,

    PRIMARY KEY ("subjectPeriodId", "gradeTypeId", "userId"),
    CONSTRAINT "subjectGradeType_subjectPeriodId_userId_fkey" FOREIGN KEY ("subjectPeriodId", "userId") REFERENCES "subjectPeriod" ("id", "userId") ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT "subjectGradeType_gradeTypeId_userId_fkey" FOREIGN KEY ("gradeTypeId", "userId") REFERENCES "gradeType" ("id", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "gradeGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subjectPeriodId" TEXT NOT NULL,
    "gradeTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1,
    CONSTRAINT "gradeGroup_subjectPeriodId_userId_fkey" FOREIGN KEY ("subjectPeriodId", "userId") REFERENCES "subjectPeriod" ("id", "userId") ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT "gradeGroup_gradeTypeId_userId_fkey" FOREIGN KEY ("gradeTypeId", "userId") REFERENCES "gradeType" ("id", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
ALTER TABLE "gradeList" ADD COLUMN "periodMode" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "subject" ADD COLUMN "isAdvanced" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "new_gradeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gradeListId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "gradeTypeId" TEXT NOT NULL,
    "subjectPeriodId" TEXT,
    "groupId" TEXT,
    "gradeText" TEXT,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "grade" REAL,
    "gradedAt" DATETIME,
    "weight" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "gradeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "gradeEntry_gradeListId_userId_fkey" FOREIGN KEY ("gradeListId", "userId") REFERENCES "gradeList" ("id", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "gradeEntry_subjectId_gradeListId_userId_fkey" FOREIGN KEY ("subjectId", "gradeListId", "userId") REFERENCES "subject" ("id", "gradeListId", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "gradeEntry_gradeTypeId_userId_fkey" FOREIGN KEY ("gradeTypeId", "userId") REFERENCES "gradeType" ("id", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "gradeEntry_subjectPeriodId_subjectId_gradeListId_userId_fkey" FOREIGN KEY ("subjectPeriodId", "subjectId", "gradeListId", "userId") REFERENCES "subjectPeriod" ("id", "subjectId", "gradeListId", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "gradeEntry_groupId_subjectPeriodId_gradeTypeId_userId_fkey" FOREIGN KEY ("groupId", "subjectPeriodId", "gradeTypeId", "userId") REFERENCES "gradeGroup" ("id", "subjectPeriodId", "gradeTypeId", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT
);
INSERT INTO "new_gradeEntry" ("createdAt", "date", "grade", "gradeListId", "gradeTypeId", "gradedAt", "id", "note", "subjectId", "title", "updatedAt", "userId", "weight") SELECT "createdAt", "date", "grade", "gradeListId", "gradeTypeId", "gradedAt", "id", "note", "subjectId", "title", "updatedAt", "userId", "weight" FROM "gradeEntry";
DROP TABLE "gradeEntry";
ALTER TABLE "new_gradeEntry" RENAME TO "gradeEntry";
CREATE INDEX "gradeEntry_userId_date_idx" ON "gradeEntry"("userId", "date");
CREATE INDEX "gradeEntry_userId_gradeListId_date_idx" ON "gradeEntry"("userId", "gradeListId", "date");
CREATE INDEX "gradeEntry_userId_subjectId_date_idx" ON "gradeEntry"("userId", "subjectId", "date");
CREATE INDEX "gradeEntry_userId_gradeTypeId_idx" ON "gradeEntry"("userId", "gradeTypeId");
CREATE INDEX "gradeEntry_userId_createdAt_idx" ON "gradeEntry"("userId", "createdAt");
CREATE INDEX "gradeEntry_userId_gradedAt_idx" ON "gradeEntry"("userId", "gradedAt");
CREATE UNIQUE INDEX "gradeEntry_id_userId_key" ON "gradeEntry"("id", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "gradePeriod_id_gradeListId_userId_key" ON "gradePeriod"("id", "gradeListId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "gradePeriod_gradeListId_position_userId_key" ON "gradePeriod"("gradeListId", "position", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "subjectPeriod_id_userId_key" ON "subjectPeriod"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "subjectPeriod_id_subjectId_gradeListId_userId_key" ON "subjectPeriod"("id", "subjectId", "gradeListId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "subjectPeriod_subjectId_periodId_userId_key" ON "subjectPeriod"("subjectId", "periodId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "gradeGroup_id_userId_key" ON "gradeGroup"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "gradeGroup_id_subjectPeriodId_gradeTypeId_userId_key" ON "gradeGroup"("id", "subjectPeriodId", "gradeTypeId", "userId");


-- Existing values, weights and recording timestamps remain unchanged.
INSERT INTO "gradePeriod" ("id", "userId", "gradeListId", "position")
SELECT 'period_' || "id", "userId", "id", 0 FROM "gradeList";
INSERT INTO "subjectPeriod" ("id", "userId", "gradeListId", "subjectId", "periodId")
SELECT 'period_' || "id", "userId", "gradeListId", "id", 'period_' || "gradeListId" FROM "subject";
UPDATE "gradeEntry" SET "subjectPeriodId" = 'period_' || "subjectId";
