import { z } from "zod";
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

function gradeInputSchema(systemId: GradingSystemId, existingGrade?: number | null) {
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
    return parseNumericInput(input);
  }, gradeEntryValueSchema(systemId, existingGrade).nullable());
}

// Request shapes intentionally omit owner IDs, stored weight, status and lock timestamps.
// Mutations obtain ownership and the selected system from the authenticated server context.
export const gradeListInputSchema = z
  .object({
    name,
    description: optionalText(2000),
    gradingSystemId: gradingSystemIdSchema,
  })
  .strict();

export const subjectInputSchema = z
  .object({
    gradeListId: id,
    name,
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
      title: z.string().trim().min(1).max(200),
      date: z.iso.date(),
      grade: gradeInputSchema(systemId, existingGrade),
      note: optionalText(20000),
    })
    .strict();
}
