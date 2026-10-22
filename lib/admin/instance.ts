import type { PrismaClient } from "@/generated/prisma/client";
import { instanceNameSchema } from "./instance-validation.ts";
import { assertAdmin } from "./service.ts";
import { logEvent } from "../logger.mjs";

export async function readInstanceName(db: PrismaClient) {
  const settings = await db.siteSettings.findUnique({
    where: { id: 1 },
    select: { instanceName: true },
  });
  return settings?.instanceName ?? "";
}

export async function saveInstanceName(db: PrismaClient, actorId: string, input: unknown) {
  await db.$transaction(async (tx) => {
    await assertAdmin(tx, actorId);
    const data = instanceNameSchema.parse(input);
    await tx.siteSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
  });
  logEvent("admin.instance_name_updated");
}
