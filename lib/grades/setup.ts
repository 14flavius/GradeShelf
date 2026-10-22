import { z } from "zod";
import {
  gradeListInputSchema,
  subjectInputSchema,
  gradeTypeInputSchema,
  normalizedGradeName,
} from "./validation.ts";

function distinctNames(items: { name: string }[]) {
  return new Set(items.map(({ name }) => normalizedGradeName(name))).size === items.length;
}

export const setupSubjectsSchema = z
  .array(subjectInputSchema.pick({ name: true }))
  .min(1)
  .max(20)
  .refine(distinctNames, { error: "DUPLICATE_NAMES" });
const setupTypesSchema = z
  .array(gradeTypeInputSchema)
  .max(10)
  .refine(distinctNames, { error: "DUPLICATE_NAMES" });
const selectedTypeIdsSchema = z
  .array(z.string().min(1).max(128))
  .max(500)
  .refine((ids) => new Set(ids).size === ids.length);
export const setupTypeSelectionSchema = z
  .object({
    types: setupTypesSchema,
    existingTypeIds: selectedTypeIdsSchema.default([]),
  })
  .refine((data) => data.types.length + data.existingTypeIds.length > 0);

export const listTypeSelectionSchema = z
  .object({
    useAllGradeTypes: z.boolean(),
    gradeTypeIds: selectedTypeIdsSchema,
  })
  .strict()
  .refine((data) => data.useAllGradeTypes || data.gradeTypeIds.length > 0);

export const setupInputSchema = z
  .object({
    // One ID per wizard run also makes a retry after a lost response safe.
    requestId: z.string().regex(/^[0-9a-f]{32}$/),
    list: gradeListInputSchema,
    subjects: setupSubjectsSchema,
    types: setupTypesSchema,
    existingTypeIds: selectedTypeIdsSchema.default([]),
    preferences: z.object({ showOnDashboard: z.boolean(), includeInOverall: z.boolean() }).strict(),
  })
  .strict()
  .refine((data) => data.types.length + data.existingTypeIds.length > 0);
