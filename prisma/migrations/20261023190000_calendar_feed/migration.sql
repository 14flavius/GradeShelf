CREATE TABLE "calendarFeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "tokenHash" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "titleTemplate" TEXT NOT NULL,
    "descriptionTemplate" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "calendarFeed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "calendarFeed_userId_key" ON "calendarFeed"("userId");
CREATE UNIQUE INDEX "calendarFeed_tokenHash_key" ON "calendarFeed"("tokenHash");
CREATE UNIQUE INDEX "calendarFeed_id_userId_key" ON "calendarFeed"("id", "userId");
CREATE TABLE "calendarFeedList" (
    "feedId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gradeListId" TEXT NOT NULL,
    PRIMARY KEY ("feedId", "gradeListId", "userId"),
    CONSTRAINT "calendarFeedList_feedId_userId_fkey" FOREIGN KEY ("feedId", "userId") REFERENCES "calendarFeed" ("id", "userId") ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT "calendarFeedList_gradeListId_userId_fkey" FOREIGN KEY ("gradeListId", "userId") REFERENCES "gradeList" ("id", "userId") ON DELETE CASCADE ON UPDATE RESTRICT
);
CREATE INDEX "calendarFeedList_userId_gradeListId_idx" ON "calendarFeedList"("userId", "gradeListId");
