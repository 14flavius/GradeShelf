import type { GradingSystemId } from "@/generated/prisma/enums";
import type { Locale } from "../i18n/config.ts";
import { gradingSystemIdSchema, gradePoints } from "./systems.ts";
import { weightSchema } from "./validation.ts";

type WeightedGrade = { grade: number | null; weight: number };
export type Average = {
  value: number | null;
  gradedCount: number;
  incomplete?: boolean;
  basis?: "ENTRIES" | "TYPES" | "SUBJECTS" | "PERIODS";
};

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

export function formatAverage(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type PeriodSettings = {
  id: string;
  period: { position: number };
  enrolled: boolean;
  weightingMode: "ENTRIES" | "PERCENTAGES";
  finalGrade: number | null;
  shares: readonly { gradeTypeId: string; share: number }[];
};
export type CalculationEntry = WeightedGrade & {
  subjectId: string;
  gradeTypeId: string;
  subjectPeriodId: string | null;
  groupId: string | null;
  group: { weight: number } | null;
};
export type CalculationSubject = { id: string; periods: readonly PeriodSettings[] };
export type CalculationList = {
  id: string;
  name: string;
  gradingSystemId: GradingSystemId;
  periodMode: "NONE" | "SCHOOL_YEAR" | "SEMESTERS";
  subjects: readonly CalculationSubject[];
  entries: readonly CalculationEntry[];
};

type PointUnit = { value: number; weight: number };
function pointAverage(units: readonly PointUnit[]): number | null {
  const denominator = units.reduce((sum, item) => sum + item.weight, 0);
  return denominator > 0
    ? units.reduce((sum, item) => sum + item.value * item.weight, 0) / denominator
    : null;
}

// Group results are already numerical points. Never reinterpret them as letter IDs
// or round them back to an input scale before combining them.
function entryUnits(systemId: GradingSystemId, entries: readonly CalculationEntry[]) {
  const groups = new Map<string, CalculationEntry[]>();
  const units: PointUnit[] = [];
  for (const entry of entries) {
    if (entry.grade === null) {
      continue;
    }
    if (entry.groupId) {
      const members = groups.get(entry.groupId) ?? [];
      members.push(entry);
      groups.set(entry.groupId, members);
    } else {
      units.push({
        value: gradePoints(systemId, entry.grade),
        weight: weightSchema.parse(entry.weight),
      });
    }
  }
  for (const members of groups.values()) {
    const value = weightedAverage(systemId, members).value;
    if (value !== null) {
      units.push({ value, weight: weightSchema.parse(members[0].group?.weight ?? 1) });
    }
  }
  return units;
}

function entryAverage(systemId: GradingSystemId, entries: readonly CalculationEntry[]) {
  return entries.some((entry) => entry.groupId)
    ? pointAverage(entryUnits(systemId, entries))
    : weightedAverage(systemId, entries).value;
}

export function finalGradeAverage(
  systemId: GradingSystemId,
  periods: readonly PeriodSettings[],
): Average {
  const enrolled = periods.filter((period) => period.period.position > 0 && period.enrolled);
  const graded = enrolled.flatMap((period) =>
    period.finalGrade === null
      ? []
      : [{ value: gradePoints(systemId, period.finalGrade), weight: 1 }],
  );
  return {
    value: pointAverage(graded),
    gradedCount: graded.length,
    incomplete: graded.length !== enrolled.length,
    basis: "PERIODS",
  };
}

export function calculateSubject(
  list: Pick<CalculationList, "gradingSystemId" | "periodMode">,
  subject: CalculationSubject,
  entries: readonly CalculationEntry[],
  position = 0,
): Average {
  const owned = entries.filter((entry) => entry.subjectId === subject.id);
  const period = subject.periods.find((item) => item.period.position === position);
  const selected =
    position === 0 ? owned : owned.filter((entry) => entry.subjectPeriodId === period?.id);
  if (list.periodMode === "SEMESTERS" && position === 0) {
    const result = finalGradeAverage(list.gradingSystemId, subject.periods);
    return {
      ...result,
      incomplete: result.incomplete || owned.some((entry) => entry.subjectPeriodId === period?.id),
    };
  }
  const settings =
    list.periodMode === "SCHOOL_YEAR"
      ? subject.periods.find((item) => item.period.position === 0)
      : period;
  const gradedCount = selected.filter((entry) => entry.grade !== null).length;
  if (period && !period.enrolled) {
    return { value: null, gradedCount: 0 };
  }
  if (settings?.weightingMode !== "PERCENTAGES") {
    return { value: entryAverage(list.gradingSystemId, selected), gradedCount, basis: "ENTRIES" };
  }
  const parts = settings.shares.map((share) => ({
    value: entryAverage(
      list.gradingSystemId,
      selected.filter((entry) => entry.gradeTypeId === share.gradeTypeId),
    ),
    weight: share.share,
  }));
  const available = parts.filter(
    (part): part is PointUnit => part.value !== null && part.weight > 0,
  );
  const unassigned = selected.some(
    (entry) =>
      entry.grade !== null &&
      !settings.shares.some((share) => share.gradeTypeId === entry.gradeTypeId),
  );
  return {
    value: unassigned ? null : pointAverage(available),
    gradedCount,
    incomplete: unassigned || parts.some((part) => part.weight > 0 && part.value === null),
    basis: "TYPES",
  };
}

export function calculateList(list: CalculationList, position = 0): Average {
  const results = list.subjects.map((subject) =>
    calculateSubject(list, subject, list.entries, position),
  );
  if (list.periodMode === "SEMESTERS" && position === 0) {
    const result = finalGradeAverage(
      list.gradingSystemId,
      list.subjects.flatMap((subject) => subject.periods),
    );
    return { ...result, incomplete: result.incomplete || results.some((item) => item.incomplete) };
  }
  if (results.some((result) => result.basis === "TYPES") || list.periodMode === "SEMESTERS") {
    return {
      value: pointAverage(
        results
          .filter((result) => result.value !== null)
          .map((result) => ({ value: result.value!, weight: 1 })),
      ),
      gradedCount: results.reduce((sum, result) => sum + result.gradedCount, 0),
      incomplete: results.some((result) => result.incomplete),
      basis: "SUBJECTS",
    };
  }
  const periodIds = new Set(
    list.subjects
      .flatMap((subject) => subject.periods)
      .filter((period) => period.period.position === position && period.enrolled)
      .map((period) => period.id),
  );
  const entries =
    position === 0
      ? list.entries
      : list.entries.filter((entry) => periodIds.has(entry.subjectPeriodId ?? ""));
  return {
    value: entryAverage(list.gradingSystemId, entries),
    gradedCount: entries.filter((entry) => entry.grade !== null).length,
    basis: "ENTRIES",
  };
}

export function overallAverages(
  lists: readonly (CalculationList & {
    status: "ACTIVE" | "ARCHIVED";
    dashboardPreference: { includeInOverall: boolean } | null;
  })[],
) {
  const simple = new Map<GradingSystemId, CalculationEntry[]>();
  const summaries: {
    key: string;
    name: string | null;
    systemId: GradingSystemId;
    average: Average;
  }[] = [];
  for (const list of lists) {
    if (list.status !== "ACTIVE" || !list.dashboardPreference?.includeInOverall) {
      continue;
    }
    const average = calculateList(list);
    if (average.basis === "ENTRIES" && !list.entries.some((entry) => entry.groupId)) {
      simple.set(list.gradingSystemId, [
        ...(simple.get(list.gradingSystemId) ?? []),
        ...list.entries,
      ]);
    } else {
      summaries.push({ key: list.id, name: list.name, systemId: list.gradingSystemId, average });
    }
  }
  for (const [systemId, entries] of simple) {
    summaries.unshift({
      key: systemId,
      name: null,
      systemId,
      average: {
        value: entryAverage(systemId, entries),
        gradedCount: entries.filter((entry) => entry.grade !== null).length,
        basis: "ENTRIES",
      },
    });
  }
  return summaries;
}
