import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { AttachmentError } from "./errors.ts";
import { attachmentIdSchema } from "./rules.ts";
import { getAttachmentLimits } from "./config.ts";
import { checkStorageQuota } from "./usage.ts";
import { validateFile } from "./validation.ts";
import { cleanupFiles, ensureStorageReady, readStoredFile, writeStoredFile } from "./storage.ts";

async function activeUser(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findFirst({
    where: { id: userId, isActive: true },
    select: { mustChangePassword: true },
  });
  if (!user) {
    throw new AttachmentError("UNAUTHENTICATED");
  }
  if (user.mustChangePassword) {
    throw new AttachmentError("PASSWORD_CHANGE_REQUIRED");
  }
}

export async function writableEntry(tx: Prisma.TransactionClient, userId: string, entryId: string) {
  await activeUser(tx, userId);
  const entry = await tx.gradeEntry.findFirst({
    where: { id: entryId, userId },
    select: { gradeList: { select: { status: true } } },
  });
  if (!entry) {
    throw new AttachmentError("NOT_FOUND");
  }
  if (entry.gradeList.status !== "ACTIVE") {
    throw new AttachmentError("ARCHIVED");
  }
}

export async function uploadAttachment(
  db: PrismaClient,
  userId: string,
  entryId: string,
  originalName: string,
  bytes: Buffer,
) {
  attachmentIdSchema.parse(entryId);
  await writableEntry(db, userId, entryId);
  const metadata = validateFile(originalName, bytes);
  const { maxAttachments } = getAttachmentLimits();
  await checkStorageQuota(db, userId, metadata.size);
  await ensureStorageReady(db);
  await cleanupFiles(db);
  const storageName = randomBytes(32).toString("hex");
  await db.fileCleanup.create({ data: { storageName, kind: "UPLOAD" } });
  try {
    await writeStoredFile(storageName, bytes);
    return await db.$transaction(async (tx) => {
      await writableEntry(tx, userId, entryId);
      // Recheck inside the metadata transaction so concurrent uploads cannot exceed quota.
      await checkStorageQuota(tx, userId, metadata.size);
      if (
        (await tx.attachment.count({ where: { userId, gradeEntryId: entryId } })) >= maxAttachments
      ) {
        throw new AttachmentError("TOO_MANY");
      }
      const attachment = await tx.attachment.create({
        data: { ...metadata, storageName, userId, gradeEntryId: entryId },
        select: { id: true, originalName: true, mimeType: true, size: true },
      });
      await tx.fileCleanup.delete({ where: { storageName } });
      return attachment;
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      await db.fileCleanup.deleteMany({ where: { storageName, kind: "UPLOAD" } });
      throw error;
    }
    // This upload has finished writing. It can now be retried by ordinary cleanup.
    await db.fileCleanup.updateMany({
      where: { storageName, kind: "UPLOAD" },
      data: { kind: "DELETE" },
    });
    await cleanupFiles(db);
    throw error;
  }
}

export async function downloadAttachment(db: PrismaClient, userId: string, id: string) {
  attachmentIdSchema.parse(id);
  await activeUser(db, userId);
  const attachment = await db.attachment.findFirst({ where: { id, userId } });
  if (!attachment) {
    throw new AttachmentError("NOT_FOUND");
  }
  await ensureStorageReady(db);
  const bytes = await readStoredFile(attachment.storageName, attachment.size);
  return { attachment, bytes };
}

export async function deleteAttachment(db: PrismaClient, userId: string, id: string) {
  attachmentIdSchema.parse(id);
  await ensureStorageReady(db);
  await db.$transaction(async (tx) => {
    const attachment = await tx.attachment.findFirst({ where: { id, userId } });
    if (!attachment) {
      throw new AttachmentError("NOT_FOUND");
    }
    await writableEntry(tx, userId, attachment.gradeEntryId);
    await tx.fileCleanup.create({ data: { storageName: attachment.storageName, kind: "DELETE" } });
    await tx.attachment.delete({ where: { id, userId } });
  });
  await cleanupFiles(db);
}

// Used inside entry, subject and list deletion transactions. Files are removed
// only after metadata commits; a rollback preserves attachments and their files.
export async function queueEntryFiles(
  tx: Prisma.TransactionClient,
  userId: string,
  entries: { id: string } | { gradeListId: string; subjectId?: string },
) {
  const where = { userId, gradeEntry: { ...entries, userId } };
  const attachments = await tx.attachment.findMany({ where, select: { storageName: true } });
  for (const attachment of attachments) {
    await tx.fileCleanup.create({ data: { storageName: attachment.storageName, kind: "DELETE" } });
  }
  await tx.attachment.deleteMany({ where });
}
