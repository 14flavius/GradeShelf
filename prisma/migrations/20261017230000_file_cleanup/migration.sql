-- Durable filesystem cleanup intents. No existing user data is modified.
CREATE TABLE "fileCleanup" (
    "storageName" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
