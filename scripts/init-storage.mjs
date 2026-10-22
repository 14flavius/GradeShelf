import "dotenv/config";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { getStoragePaths } from "../lib/storage-config.mjs";
import { logEvent } from "../lib/logger.mjs";

process.umask(0o077);

function initializeStorage() {
  const { dataDir, databasePath, uploadsDir } = getStoragePaths();
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  mkdirSync(uploadsDir, { recursive: true, mode: 0o700 });
  const db = new Database(databasePath);
  try {
    db.pragma("busy_timeout = 5000");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    if (db.pragma("foreign_keys", { simple: true }) !== 1) {
      throw new Error("Foreign keys unavailable");
    }
  } finally {
    db.close();
  }
  logEvent("storage.ready");
}

try {
  initializeStorage();
} catch {
  logEvent("storage.initialization_failed", "error");
  process.exitCode = 1;
}
