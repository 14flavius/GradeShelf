ALTER TABLE "gradeList" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "gradeList_one_default_per_user"
ON "gradeList"("userId") WHERE "isDefault" = 1;
