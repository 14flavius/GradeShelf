import { z } from "zod";
import { gradeListInputSchema, subjectInputSchema, gradeTypeInputSchema } from "./validation.ts";
import { setupInputSchema, listTypeSelectionSchema } from "./setup.ts";

const listEditorInput = gradeListInputSchema.extend({
  preferences: z
    .object({ showOnDashboard: z.boolean(), includeInOverall: z.boolean() })
    .strict()
    .optional(),
});
const id = z.string().min(1).max(128);
export const deleteConfirmationSchema = z
  .string()
  .trim()
  .max(32)
  .refine((value) => ["delete", "löschen"].includes(value.normalize("NFC").toLowerCase()));
export const gradeCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setup.create"), data: setupInputSchema }).strict(),
  z.object({ action: z.literal("list.create"), data: listEditorInput }).strict(),
  z.object({ action: z.literal("list.update"), id, data: listEditorInput }).strict(),
  z.object({ action: z.literal("list.types"), id, data: listTypeSelectionSchema }).strict(),
  z.object({ action: z.literal("list.default"), id, enabled: z.boolean() }).strict(),
  z
    .object({ action: z.literal("list.delete"), id, confirmation: deleteConfirmationSchema })
    .strict(),
  z
    .object({ action: z.literal("list.status"), id, status: z.enum(["ACTIVE", "ARCHIVED"]) })
    .strict(),
  z
    .object({
      action: z.literal("list.preferences"),
      id,
      data: z.object({ showOnDashboard: z.boolean(), includeInOverall: z.boolean() }).strict(),
    })
    .strict(),
  z.object({ action: z.literal("subject.create"), data: subjectInputSchema }).strict(),
  z.object({ action: z.literal("subject.update"), id, data: subjectInputSchema }).strict(),
  z
    .object({ action: z.literal("subject.delete"), id, confirmation: deleteConfirmationSchema })
    .strict(),
  z.object({ action: z.literal("type.create"), data: gradeTypeInputSchema }).strict(),
  z.object({ action: z.literal("type.update"), id, data: gradeTypeInputSchema }).strict(),
  z.object({ action: z.literal("type.delete"), id }).strict(),
  // Entry values are validated against the owned list's system inside the transaction.
  z.object({ action: z.literal("entry.create"), data: z.unknown() }).strict(),
  z.object({ action: z.literal("entry.update"), id, data: z.unknown() }).strict(),
  z.object({ action: z.literal("entry.delete"), id }).strict(),
]);
export type GradeCommand = z.input<typeof gradeCommandSchema>;
