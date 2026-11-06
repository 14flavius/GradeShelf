import { z } from "zod";
import {
  gradeListInputSchema,
  subjectInputSchema,
  gradeTypeInputSchema,
  normalizedGradeName,
} from "./validation.ts";
import { hasCompleteShares } from "./weighting.ts";

export const setupWeightingSchema = z
  .object({
    weightingMode: z.enum(["ENTRIES", "PERCENTAGES"]),
    // Indices refer to the selected existing types followed by the new types.
    shares: z
      .array(
        z
          .object({
            typeIndex: z.number().int().min(0).max(509),
            share: z.number().int().min(0).max(10000),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .refine(
    (data) =>
      new Set(data.shares.map((item) => item.typeIndex)).size === data.shares.length &&
      (data.weightingMode === "PERCENTAGES"
        ? hasCompleteShares(data.shares)
        : data.shares.length === 0),
    { error: "INVALID_SHARES" },
  );

function distinctNames(items: { name: string }[]) {
  return new Set(items.map(({ name }) => normalizedGradeName(name))).size === items.length;
}

export const setupSubjectsSchema = z
  .array(
    subjectInputSchema.pick({ name: true, isAdvanced: true }).extend({
      enrolledPeriods: z
        .array(z.number().int().min(1).max(4))
        .min(1)
        .max(4)
        .refine((values) => new Set(values).size === values.length)
        .optional(),
      weighting: setupWeightingSchema.optional(),
    }),
  )
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
    semesterWeighting: setupWeightingSchema.optional(),
    preferences: z.object({ showOnDashboard: z.boolean(), includeInOverall: z.boolean() }).strict(),
  })
  .strict()
  .refine((data) => data.types.length + data.existingTypeIds.length > 0)
  .superRefine((data, ctx) => {
    if (
      data.list.periodMode !== "SEMESTERS" &&
      (data.semesterWeighting ||
        data.subjects.some(
          (subject) =>
            subject.isAdvanced !== undefined || subject.enrolledPeriods || subject.weighting,
        ))
    ) {
      ctx.addIssue({ code: "custom", message: "INVALID_SEMESTER_SETTINGS" });
    }
    const count = data.existingTypeIds.length + data.types.length;
    for (const weighting of [
      data.semesterWeighting,
      ...data.subjects.map((subject) => subject.weighting),
    ]) {
      if (
        weighting &&
        (weighting.shares.some((share) => share.typeIndex >= count) ||
          (weighting.weightingMode === "PERCENTAGES" && weighting.shares.length !== count))
      ) {
        ctx.addIssue({ code: "custom", message: "INVALID_TYPE_SELECTION" });
      }
    }
  });
