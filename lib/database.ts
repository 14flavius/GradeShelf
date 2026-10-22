import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client.ts";
import { getStoragePaths } from "./storage-config.mjs";
import { logEvent } from "./logger.mjs";

// Shared by the server and local maintenance commands; never import into client code.
export async function connectDatabase() {
  const adapter = new PrismaBetterSqlite3({ url: getStoragePaths().databaseUrl });
  const db = new PrismaClient({ adapter, log: [] });
  try {
    await db.$queryRaw`PRAGMA journal_mode = WAL`;
    await db.$executeRaw`PRAGMA foreign_keys = ON`;
    await db.$queryRaw`PRAGMA busy_timeout = 5000`;
    return db;
  } catch {
    await db.$disconnect();
    logEvent("database.connection_failed", "error");
    throw new Error("Die Datenbank ist derzeit nicht erreichbar.");
  }
}
