import type { Prisma } from "@/generated/prisma/client";
import { getAttachmentLimits } from "./config.ts";
import { AttachmentError } from "./errors.ts";

export async function attachmentUsage(db: Prisma.TransactionClient, userId: string) {
  const result = await db.attachment.aggregate({
    where: { userId },
    _sum: { size: true },
  });
  return result._sum.size ?? 0;
}

export async function checkStorageQuota(
  db: Prisma.TransactionClient,
  userId: string,
  additionalBytes: number,
) {
  const { maxUserStorage } = getAttachmentLimits();
  if (
    maxUserStorage > 0 &&
    (await attachmentUsage(db, userId)) + additionalBytes > maxUserStorage
  ) {
    throw new AttachmentError("QUOTA_EXCEEDED");
  }
}
