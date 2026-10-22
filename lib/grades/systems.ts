import { z } from "zod";
import type { GradingSystemId } from "@/generated/prisma/enums";
import type { MessageKey } from "../i18n/messages.ts";

const usLetterGrades = [
  { label: "F", value: 0, points: 0 },
  { label: "D-", value: 1, points: 0.67 },
  { label: "D", value: 2, points: 1 },
  { label: "D+", value: 3, points: 1.33 },
  { label: "C-", value: 4, points: 1.67 },
  { label: "C", value: 5, points: 2 },
  { label: "C+", value: 6, points: 2.33 },
  { label: "B-", value: 7, points: 2.67 },
  { label: "B", value: 8, points: 3 },
  { label: "B+", value: 9, points: 3.33 },
  { label: "A-", value: 10, points: 3.67 },
  { label: "A", value: 11, points: 4 },
  { label: "A+", value: 12, points: 4 },
] as const;

// Letter values identify categories; only their explicit points enter averages.
// A and A+ remain distinct even though both carry 4.00 points.
type GradingSystem = {
  labelKey: MessageKey;
  min: number;
  max: number;
  decimalPlaces: number;
  entryStep: number;
  direction: "LOWER_IS_BETTER" | "HIGHER_IS_BETTER";
  unit: "GRADE" | "POINTS" | "PERCENT";
  letters?: typeof usLetterGrades;
};

// Versioned input scales, not official equivalence/conversion rules between institutions.
// Stored ranges, precision, direction and units remain stable for existing records.
// entryStep constrains new grades; historical values are never rounded or reinterpreted.
export const gradingSystems = {
  de_school_v1: {
    labelKey: "scaleGerman",
    min: 1,
    max: 6,
    decimalPlaces: 2,
    entryStep: 1,
    direction: "LOWER_IS_BETTER",
    unit: "GRADE",
  },
  school_1_5_v1: {
    labelKey: "scaleOneFive",
    min: 1,
    max: 5,
    decimalPlaces: 2,
    entryStep: 1,
    direction: "LOWER_IS_BETTER",
    unit: "GRADE",
  },
  ascending_1_6_v1: {
    labelKey: "scaleAscendingSix",
    min: 1,
    max: 6,
    decimalPlaces: 2,
    entryStep: 0.5,
    direction: "HIGHER_IS_BETTER",
    unit: "GRADE",
  },
  upper_secondary_15_v1: {
    labelKey: "scaleFifteen",
    min: 0,
    max: 15,
    decimalPlaces: 0,
    entryStep: 1,
    direction: "HIGHER_IS_BETTER",
    unit: "POINTS",
  },
  percent_v1: {
    labelKey: "scalePercent",
    min: 0,
    max: 100,
    decimalPlaces: 2,
    entryStep: 0.01,
    direction: "HIGHER_IS_BETTER",
    unit: "PERCENT",
  },
  scale_10_v1: {
    labelKey: "scaleTen",
    min: 0,
    max: 10,
    decimalPlaces: 2,
    entryStep: 0.01,
    direction: "HIGHER_IS_BETTER",
    unit: "GRADE",
  },
  scale_20_v1: {
    labelKey: "scaleTwenty",
    min: 0,
    max: 20,
    decimalPlaces: 2,
    entryStep: 0.01,
    direction: "HIGHER_IS_BETTER",
    unit: "GRADE",
  },
  grade_points_4_v1: {
    labelKey: "scaleGradePoints",
    min: 0,
    max: 4,
    decimalPlaces: 2,
    entryStep: 0.01,
    direction: "HIGHER_IS_BETTER",
    unit: "POINTS",
  },
  us_letters_4_v1: {
    labelKey: "scaleUsLetters",
    min: 0,
    max: 12,
    decimalPlaces: 0,
    entryStep: 1,
    direction: "HIGHER_IS_BETTER",
    unit: "POINTS",
    letters: usLetterGrades,
  },
} as const satisfies Record<GradingSystemId, GradingSystem>;

export const gradingSystemIdSchema = z.custom<GradingSystemId>(
  (value) => typeof value === "string" && Object.hasOwn(gradingSystems, value),
  { error: "INVALID_GRADING_SYSTEM" },
);

function gradeValueSchema(systemId: GradingSystemId) {
  const system = gradingSystems[gradingSystemIdSchema.parse(systemId)];
  const factor = 10 ** system.decimalPlaces;
  return z
    .number()
    .min(system.min)
    .max(system.max)
    .refine((value) => Math.abs(value * factor - Math.round(value * factor)) < 1e-8, {
      error: "INVALID_GRADE_PRECISION",
    })
    .transform((value) => Math.round(value * factor) / factor);
}

export function gradeEntryValueSchema(systemId: GradingSystemId, existingGrade?: number | null) {
  const { min, entryStep } = gradingSystems[gradingSystemIdSchema.parse(systemId)];
  return gradeValueSchema(systemId).refine(
    (value) => {
      // Only an unchanged value from the owned database entry is grandfathered.
      if (value === existingGrade) {
        return true;
      }
      const steps = (value - min) / entryStep;
      return Math.abs(steps - Math.round(steps)) < 1e-8;
    },
    { error: "INVALID_GRADE_STEP" },
  );
}

export function numericGradeChoices(systemId: GradingSystemId) {
  const { min, max, entryStep } = gradingSystems[systemId];
  if (letterGrades(systemId) || entryStep < 0.5) {
    return null;
  }
  return Array.from(
    { length: Math.round((max - min) / entryStep) + 1 },
    (_, index) => min + index * entryStep,
  );
}

export function letterGrades(systemId: GradingSystemId) {
  const system = gradingSystems[systemId];
  return "letters" in system ? system.letters : null;
}

export function gradePoints(systemId: GradingSystemId, value: number) {
  const valid = gradeValueSchema(systemId).parse(value);
  return letterGrades(systemId)?.find((letter) => letter.value === valid)?.points ?? valid;
}

export function formatGrade(value: number, systemId: GradingSystemId, locale: "en" | "de") {
  const letters = letterGrades(systemId);
  if (letters) {
    return letters.find((letter) => letter.value === value)?.label ?? "—";
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}
