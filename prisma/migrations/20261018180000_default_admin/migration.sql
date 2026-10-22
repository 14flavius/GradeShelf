-- Record first-start initialization without changing existing accounts.
CREATE TABLE "bootstrapState" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "initializedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
