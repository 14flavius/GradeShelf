import { z } from "zod";

export const instanceNameMaxLength = 60;

export const instanceNameSchema = z
  .object({
    instanceName: z
      .string()
      .trim()
      .max(instanceNameMaxLength)
      .regex(/^[^\p{Cc}\p{Cf}\u2028\u2029]*$/u),
  })
  .strict();
