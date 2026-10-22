-- Existing accounts have no reliable first-login history; preserve them.
ALTER TABLE "user" ADD COLUMN "isUnusedDefaultAdmin" BOOLEAN NOT NULL DEFAULT false;
