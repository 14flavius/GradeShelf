-- Existing lists keep access to all account-wide grade types.
ALTER TABLE "gradeList" ADD COLUMN "useAllGradeTypes" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "gradeListType" (
    "gradeListId" TEXT NOT NULL,
    "gradeTypeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    PRIMARY KEY ("gradeListId", "gradeTypeId", "userId"),
    CONSTRAINT "gradeListType_gradeListId_userId_fkey" FOREIGN KEY ("gradeListId", "userId") REFERENCES "gradeList" ("id", "userId") ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT "gradeListType_gradeTypeId_userId_fkey" FOREIGN KEY ("gradeTypeId", "userId") REFERENCES "gradeType" ("id", "userId") ON DELETE CASCADE ON UPDATE RESTRICT
);
CREATE INDEX "gradeListType_userId_gradeTypeId_idx" ON "gradeListType"("userId", "gradeTypeId");
