import type { PrismaClient } from "@/generated/prisma/client";
import { adminContactSchema } from "./contact-validation.ts";
import { assertAdmin } from "./service.ts";
import { logEvent } from "../logger.mjs";

export async function readAdminContact(db: PrismaClient) {
  const settings = await db.siteSettings.findUnique({
    where: { id: 1 },
    select: { adminContact: true },
  });
  return settings?.adminContact ?? "";
}

export async function saveAdminContact(db: PrismaClient, actorId: string, input: unknown) {
  await db.$transaction(async (tx) => {
    await assertAdmin(tx, actorId);
    const data = adminContactSchema.parse(input);
    await tx.siteSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
  });
  logEvent("admin.contact_updated");
}
