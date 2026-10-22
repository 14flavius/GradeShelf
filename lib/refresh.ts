import type { PrismaClient } from "@/generated/prisma/client";

export const REFRESH_COOLDOWN_MS = 10_000;

export async function claimRefresh(db: PrismaClient, userId: string) {
  // Reuse the existing rate-limit storage so the per-account limit survives restarts.
  const key = `gradeshelf:refresh:${userId}`;
  return db.$transaction(async (tx) => {
    const now = Date.now();
    const previous = await tx.rateLimit.upsert({
      where: { key },
      create: { key, count: 0, lastRequest: BigInt(0) },
      update: {},
    });
    const retryAfterMs = Number(previous.lastRequest) + REFRESH_COOLDOWN_MS - now;
    if (retryAfterMs > 0) {
      return { allowed: false, retryAfterMs };
    }
    await tx.rateLimit.update({
      where: { key },
      data: { count: 1, lastRequest: BigInt(now) },
    });
    return { allowed: true, retryAfterMs: REFRESH_COOLDOWN_MS };
  });
}
