import { constants } from "node:fs";
import { mkdir, lstat, open, unlink, realpath } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@/generated/prisma/client";
import { getStoragePaths } from "../storage-config.mjs";
import { logEvent } from "../logger.mjs";
import { AttachmentError } from "./errors.ts";
import { absoluteMaxFileSize } from "./rules.ts";

const storageNamePattern = /^[a-f0-9]{64}$/;

function storedPath(storageName: string) {
  if (!storageNamePattern.test(storageName)) {
    throw new Error("INVALID_STORAGE_NAME");
  }
  return path.join(getStoragePaths().uploadsDir, storageName);
}

async function checkDirectory() {
  const { uploadsDir } = getStoragePaths();
  await mkdir(uploadsDir, { recursive: true, mode: 0o700 });
  const stat = await lstat(uploadsDir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("INVALID_UPLOAD_DIRECTORY");
  }
  const actual = await realpath(uploadsDir);
  const publicDir = await realpath(path.resolve("public")).catch((error: unknown) => {
    if (isMissing(error)) {
      return path.resolve("public");
    }
    throw error;
  });
  if (actual === publicDir || actual.startsWith(publicDir + path.sep)) {
    throw new Error("PUBLIC_UPLOAD_DIRECTORY");
  }
}

// One application instance is supported. Startup recovery runs before this process
// starts any uploads; runtime retries only process DELETE, never live UPLOAD jobs.
const storageGlobal = globalThis as unknown as {
  gradeShelfStorageRecovery?: WeakMap<PrismaClient, Promise<void>>;
};
const recovery = (storageGlobal.gradeShelfStorageRecovery ??= new WeakMap<
  PrismaClient,
  Promise<void>
>());

export function ensureStorageReady(db: PrismaClient) {
  let ready = recovery.get(db);
  if (!ready) {
    ready = checkDirectory()
      .then(async () => {
        await db.fileCleanup.updateMany({ where: { kind: "UPLOAD" }, data: { kind: "DELETE" } });
        await cleanupFiles(db);
      })
      .catch((error: unknown) => {
        recovery.delete(db);
        throw error;
      });
    recovery.set(db, ready);
  }
  return ready;
}

export async function cleanupFiles(db: PrismaClient) {
  let jobs;
  try {
    jobs = await db.fileCleanup.findMany({ where: { kind: "DELETE" } });
  } catch {
    logEvent("attachments.cleanup_failed", "error");
    return;
  }
  for (const job of jobs) {
    try {
      // A committed attachment wins if an operator restored mismatched backups.
      if (
        await db.attachment.findUnique({
          where: { storageName: job.storageName },
          select: { id: true },
        })
      ) {
        logEvent("attachments.cleanup_conflict", "error");
        continue;
      }
      try {
        await unlink(storedPath(job.storageName));
      } catch (error) {
        if (!isMissing(error)) {
          // Leave the durable job for a later retry.
          logEvent("attachments.cleanup_failed", "error");
          continue;
        }
      }
      await db.fileCleanup.deleteMany({ where: { storageName: job.storageName, kind: job.kind } });
    } catch {
      // Keep the durable job for retry. Never log paths, filenames or raw errors.
      logEvent("attachments.cleanup_failed", "error");
    }
  }
}

export async function writeStoredFile(storageName: string, bytes: Buffer) {
  const file = await open(storedPath(storageName), "wx", 0o600);
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
}

export async function readStoredFile(storageName: string, expectedSize: number) {
  // Lowering upload limits must never prevent access to existing attachments.
  if (
    !Number.isSafeInteger(expectedSize) ||
    expectedSize <= 0 ||
    expectedSize > absoluteMaxFileSize
  ) {
    throw new AttachmentError("FILE_MISSING");
  }
  const file = await open(
    storedPath(storageName),
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  ).catch((error: unknown) => {
    if (isMissing(error)) {
      throw new AttachmentError("FILE_MISSING");
    }
    throw error;
  });
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size !== expectedSize || stat.size > absoluteMaxFileSize) {
      throw new AttachmentError("FILE_MISSING");
    }
    // Bound the read even if another process changes the file while it is open.
    const bytes = Buffer.alloc(expectedSize);
    let offset = 0;
    while (offset < expectedSize) {
      const result = await file.read(bytes, offset, expectedSize - offset, offset);
      if (result.bytesRead === 0) {
        throw new AttachmentError("FILE_MISSING");
      }
      offset += result.bytesRead;
    }
    if ((await file.stat()).size !== expectedSize) {
      throw new AttachmentError("FILE_MISSING");
    }
    return bytes;
  } finally {
    await file.close();
  }
}

function isMissing(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
