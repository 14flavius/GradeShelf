-- Additive: preserve existing grades, relationships and timestamps.
ALTER TABLE "gradeEntry" ADD COLUMN "gradedAt" DATETIME;

-- Historical first-grading times were not recorded. updatedAt is the best available
-- approximation; ungraded entries deliberately keep NULL.
UPDATE "gradeEntry" SET "gradedAt" = "updatedAt" WHERE "grade" IS NOT NULL;

CREATE INDEX "gradeEntry_userId_gradedAt_idx" ON "gradeEntry"("userId", "gradedAt");
