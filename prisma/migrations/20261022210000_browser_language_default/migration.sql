-- Preserve existing account preferences. New accounts follow the browser until a language is chosen.
ALTER TABLE "user" ADD COLUMN "localeSelected" BOOLEAN NOT NULL DEFAULT false;
UPDATE "user" SET "localeSelected" = true;
