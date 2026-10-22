import type { GradingSystemId } from "@/generated/prisma/enums";
import type { Locale } from "../i18n/config.ts";
import { gradingSystemIdSchema, gradePoints } from "./systems.ts";
import { weightSchema } from "./validation.ts";

type WeightedGrade = { grade: number | null; weight: number };
export type Average = { value: number | null; gradedCount: number };

export function weightedAverage(
  systemId: GradingSystemId,
  entries: readonly WeightedGrade[],
): Average {
  gradingSystemIdSchema.parse(systemId);
  let weightedSum = 0;
  let weightSum = 0;
  let gradedCount = 0;
  for (const entry of entries) {
    if (entry.grade === null) {
      continue;
    }
    // Stored grades and weights have at most two decimal places. Integer hundredths
    // avoid accumulated binary decimal errors; no intermediate averages are rounded.
    const gradeUnits = Math.round(gradePoints(systemId, entry.grade) * 100);
    const weightUnits = Math.round(weightSchema.parse(entry.weight) * 100);
    weightedSum += gradeUnits * weightUnits;
    weightSum += weightUnits;
    if (!Number.isSafeInteger(weightedSum) || !Number.isSafeInteger(weightSum)) {
      throw new RangeError("AVERAGE_CAPACITY_EXCEEDED");
    }
    gradedCount++;
  }
  return {
    value: gradedCount === 0 ? null : weightedSum / weightSum / 100,
    gradedCount,
  };
}

export function subjectAverages(
  systemId: GradingSystemId,
  entries: readonly (WeightedGrade & { subjectId: string })[],
) {
  const groups = new Map<string, WeightedGrade[]>();
  for (const entry of entries) {
    const group = groups.get(entry.subjectId) ?? [];
    group.push(entry);
    groups.set(entry.subjectId, group);
  }
  return new Map([...groups].map(([id, grades]) => [id, weightedAverage(systemId, grades)]));
}

type ListForAverage = {
  gradingSystemId: GradingSystemId;
  status: "ACTIVE" | "ARCHIVED";
  dashboardPreference: { includeInOverall: boolean } | null;
  entries: readonly WeightedGrade[];
};

export function overallAverages(lists: readonly ListForAverage[]) {
  const groups = new Map<GradingSystemId, WeightedGrade[]>();
  for (const list of lists) {
    if (list.status !== "ACTIVE" || !list.dashboardPreference?.includeInOverall) {
      continue;
    }
    const group = groups.get(list.gradingSystemId) ?? [];
    for (const entry of list.entries) {
      group.push(entry);
    }
    groups.set(list.gradingSystemId, group);
  }
  // Keep selected but ungraded scales visible with a null average.
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([systemId, entries]) => ({ systemId, average: weightedAverage(systemId, entries) }));
}

export function formatAverage(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
