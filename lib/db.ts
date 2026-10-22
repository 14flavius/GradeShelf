import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { connectDatabase } from "@/lib/database";

const globalForDb = globalThis as unknown as {
  gradeShelfDb?: Promise<PrismaClient>;
};

// Lazy initialization keeps database files out of builds. A failed connection can retry.
export function getDb() {
  globalForDb.gradeShelfDb ??= connectDatabase().catch((error: unknown) => {
    globalForDb.gradeShelfDb = undefined;
    throw error;
  });
  return globalForDb.gradeShelfDb;
}
