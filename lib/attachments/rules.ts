import { z } from "zod";

// Bound memory use even when an operator increases upload limits.
export const absoluteMaxFileSize = 100 * 1024 * 1024;
export type AttachmentLimits = {
  maxFileSize: number;
  maxAttachments: number;
  maxUserStorage: number;
};
export const attachmentAccept = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.hif,image/heic,image/heif";
export const attachmentNameSchema = z
  .string()
  .min(1)
  .max(180)
  .refine(
    (name) =>
      !/[\x00-\x1f\x7f/\\<>:"|?*]/.test(name) &&
      !/[\u202a-\u202e\u2066-\u2069]/u.test(name) &&
      !name.startsWith(".") &&
      !/[. ]$/.test(name) &&
      name === name.trim() &&
      !/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name),
    "INVALID_FILENAME",
  );
export const attachmentIdSchema = z.string().min(1).max(128);
export type AttachmentView = { id: string; originalName: string; size: number };
