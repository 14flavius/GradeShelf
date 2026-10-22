import { z } from "zod";

export const adminContactMaxLength = 100;

export const adminContactSchema = z
  .object({ adminContact: z.string().max(adminContactMaxLength).trim() })
  .strict();
