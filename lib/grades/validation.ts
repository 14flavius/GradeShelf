import { z } from "zod";
import { parseTendency } from "./grade-input.ts";
import { hasCompleteShares } from "./weighting.ts";
import type { GradingSystemId } from "@/generated/prisma/enums";
import { gradeEntryValueSchema, gradingSystemIdSchema, letterGrades } from "./systems.ts";

const id = z.string().min(1).max(128);
const name = z.string().trim().min(1).max(120);

export function normalizedGradeName(value: string) {
  return value.trim().normalize("NFC").toLowerCase();
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value || null);

function parseNumericInput(input: unknown) {
  if (typeof input !== "string") {
    return input;
  }
  const value = input.trim();
  // No implicit empty-string-to-zero conversion, exponents, or thousands separators.
  return /^\d+(?:[.,]\d+)?$/.test(value) ? Number(value.replace(",", ".")) : input;
}

export const weightSchema = z
  .number()
  .min(0.01)
  .max(1000)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, {
    error: "INVALID_WEIGHT_PRECISION",
  })
  .transform((value) => Math.round(value * 100) / 100);

export function gradeInputSchema(systemId: GradingSystemId, existingGrade?: number | null) {
  return z.preprocess((input) => {
    if (input === undefined || (typeof input === "string" && input.trim() === "")) {
      return null;
    }
    const letters = letterGrades(systemId);
    if (letters && typeof input === "string") {
      return (
        letters.find((letter) => letter.label === input.trim().toUpperCase().replace("−", "-"))
          ?.value ?? input
      );
    }
    if (systemId === "de_school_extended_v1" && typeof input === "string") {
      return parseTendency(input) ?? parseNumericInput(input);
    }
    return parseNumericInput(input);
  }, gradeEntryValueSchema(systemId, existingGrade).nullable());
}

// Request shapes intentionally omit owner IDs, status and lock timestamps.
// Mutations obtain ownership and the selected system from the authenticated server context.
export const gradeListInputSchema = z
  .object({
    name,
    description: optionalText(2000),
    gradingSystemId: gradingSystemIdSchema,
    periodMode: z.enum(["NONE", "SCHOOL_YEAR", "SEMESTERS"]).optional(),
  })
  .strict();

export const subjectInputSchema = z
  .object({
    gradeListId: id,
    name,
    isAdvanced: z.boolean().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional()
      .transform((value) => value?.toUpperCase() ?? null),
  })
  .strict();

export const gradeTypeInputSchema = z
  .object({
    name,
    weight: z.preprocess(parseNumericInput, weightSchema),
  })
  .strict();

export function gradeEntryInputSchema(systemId: GradingSystemId, existingGrade?: number | null) {
  return z
    .object({
      gradeListId: id,
      subjectId: id,
      gradeTypeId: id,
      subjectPeriodId: id.nullable().optional(),
      groupId: id.nullable().optional(),
      newGroupName: optionalText(120),
      weight: z.preprocess(parseNumericInput, weightSchema).optional(),
      gradeText: z.string().max(16).nullable().optional(),
      title: z.string().trim().min(1).max(200),
      date: z.iso.date(),
      grade: gradeInputSchema(systemId, existingGrade),
      note: optionalText(20000),
    })
    .strict();
}

export const subjectPeriodInputSchema = z
  .object({
    enrolled: z.boolean(),
    weightingMode: z.enum(["ENTRIES", "PERCENTAGES"]),
    shares: z
      .array(z.object({ gradeTypeId: id, share: z.number().int().min(0).max(10000) }).strict())
      .max(100),
    finalGrade: z.number().nullable(),
  })
  .strict()
  .refine(
    (data) =>
      new Set(data.shares.map((item) => item.gradeTypeId)).size === data.shares.length &&
      (data.weightingMode !== "PERCENTAGES" || hasCompleteShares(data.shares)),
    { error: "INVALID_SHARES" },
  );

export const gradeGroupInputSchema = z
  .object({
    subjectPeriodId: id,
    gradeTypeId: id,
    name,
    weight: z.preprocess(parseNumericInput, weightSchema),
  })
  .strict();
