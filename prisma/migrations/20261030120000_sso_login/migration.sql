CREATE TABLE "ssoSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "issuer" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "encryptedClientSecret" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "session" ADD COLUMN "ssoAccountId" TEXT REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session" ADD COLUMN "ssoRevision" INTEGER;
CREATE INDEX "session_ssoAccountId_idx" ON "session"("ssoAccountId");

-- One external identity per user; local credentials remain available.
CREATE UNIQUE INDEX "account_oidc_user_key" ON "account"("userId") WHERE "providerId" = 'oidc';
