import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { assertAdmin } from "./service.ts";
import { logEvent } from "../logger.mjs";

const imprintSchema = z
  .object({
    imprintEnabled: z.boolean(),
    imprintText: z.string().trim().max(20000),
  })
  .strict()
  .refine((value) => !value.imprintEnabled || value.imprintText.length > 0);

export type ImprintSettings = z.infer<typeof imprintSchema>;

export async function readImprint(db: PrismaClient): Promise<ImprintSettings> {
  const settings = await db.siteSettings.findUnique({
    where: { id: 1 },
    select: { imprintEnabled: true, imprintText: true },
  });
  return settings ?? { imprintEnabled: false, imprintText: "" };
}

export async function saveImprint(db: PrismaClient, actorId: string, input: unknown) {
  await db.$transaction(async (tx) => {
    await assertAdmin(tx, actorId);
    const data = imprintSchema.parse(input);
    await tx.siteSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
  });
  logEvent("admin.imprint_updated");
}
