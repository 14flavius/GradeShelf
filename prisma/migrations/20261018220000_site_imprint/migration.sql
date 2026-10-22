CREATE TABLE "siteSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "imprintEnabled" BOOLEAN NOT NULL DEFAULT false,
    "imprintText" TEXT NOT NULL DEFAULT ''
);
