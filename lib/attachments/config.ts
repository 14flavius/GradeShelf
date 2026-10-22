import { z } from "zod";
import { absoluteMaxFileSize, type AttachmentLimits } from "./rules.ts";

const configSchema = z.object({
  UPLOAD_MAX_FILE_MB: z.coerce
    .number()
    .int()
    .min(1)
    .max(absoluteMaxFileSize / 1024 ** 2)
    .default(10),
  UPLOAD_MAX_FILES_PER_ENTRY: z.coerce.number().int().min(1).max(100).default(10),
  UPLOAD_MAX_USER_GB: z.coerce.number().min(0).max(1024).default(0),
});

// Read only on the server, at runtime: the same Docker image works with any limits.
export function getAttachmentLimits(): AttachmentLimits {
  const result = configSchema.safeParse({
    UPLOAD_MAX_FILE_MB: process.env.UPLOAD_MAX_FILE_MB,
    UPLOAD_MAX_FILES_PER_ENTRY: process.env.UPLOAD_MAX_FILES_PER_ENTRY,
    UPLOAD_MAX_USER_GB: process.env.UPLOAD_MAX_USER_GB,
  });
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path[0]))];
    throw new Error(`Invalid upload configuration: ${fields.join(", ")}. See .env.example.`);
  }
  return {
    maxFileSize: result.data.UPLOAD_MAX_FILE_MB * 1024 ** 2,
    maxAttachments: result.data.UPLOAD_MAX_FILES_PER_ENTRY,
    maxUserStorage:
      result.data.UPLOAD_MAX_USER_GB === 0
        ? 0
        : Math.max(1, Math.floor(result.data.UPLOAD_MAX_USER_GB * 1024 ** 3)),
  };
}
