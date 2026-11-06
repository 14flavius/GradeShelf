import { calculationSubjectSelect, readCalculationEntries } from "./calculation-data.ts";
import type { GradingSystemId, PrismaClient } from "@/generated/prisma/client";
import {
  formatAverage,
  weightedAverage,
  calculateList,
  calculateSubject,
  type Average,
} from "./averages.ts";
import { gradingSystems } from "./systems.ts";

type TrendEntry = {
  id: string;
  title?: string;
  subject?: { name: string };
  date: string;
  gradedAt?: Date | string | null;
  grade: number | null;
  weight: number;
};
const recordedTime = (entry: TrendEntry) =>
  entry.gradedAt ? new Date(entry.gradedAt).getTime() : 0;

const windowSize = 10;

// Each point averages that grade and up to nine preceding grades, in examination order.
// The overall averages elsewhere still include all grades.
export function gradeTrend<T extends TrendEntry>(
  systemId: GradingSystemId,
  entries: readonly T[],
  calculate?: (entries: readonly T[]) => Average,
) {
  const ordered = entries
    .filter((entry): entry is T & { grade: number } => entry.grade !== null)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        recordedTime(a) - recordedTime(b) ||
        a.id.localeCompare(b.id),
    );
  const start = Math.max(0, ordered.length - windowSize);
  const points = ordered
    .slice(start)
    .map((entry, index) => {
      const position = start + index + 1;
      const windowStart = calculate ? 0 : Math.max(0, position - windowSize);
      const slice = ordered.slice(windowStart, position);
      const value = (calculate ? calculate(slice) : weightedAverage(systemId, slice)).value;
      if (value === null) {
        return null;
      }
      return {
        id: entry.id,
        title: entry.title ?? "",
        subjectName: entry.subject?.name ?? "",
        date: entry.date,
        grade: entry.grade,
        weight: entry.weight,
        gradeText:
          "gradeText" in entry && typeof entry.gradeText === "string" ? entry.gradeText : null,
        position,
        firstPosition: windowStart + 1,
        value,
      };
    })
    .filter((point) => point !== null);
  const current = points.at(-1)?.value ?? null;
  if (current === null || points.length < 2) {
    return {
      cumulative: !!calculate,
      status: "INSUFFICIENT" as const,
      current,
      difference: null,
      points,
    };
  }
  // Compare the displayed endpoints so rounding cannot contradict the change label.
  // The curve and current average retain their full precision.
  const firstDisplayed = Number(formatAverage(points[0].value, "en"));
  const currentDisplayed = Number(formatAverage(current, "en"));
  const difference = Math.round((currentDisplayed - firstDisplayed) * 100) / 100;
  const improvement =
    difference * (gradingSystems[systemId].direction === "LOWER_IS_BETTER" ? -1 : 1);
  const status =
    difference === 0
      ? ("STABLE" as const)
      : improvement > 0
        ? ("IMPROVING" as const)
        : ("DECLINING" as const);
  return { cumulative: !!calculate, status, current, difference, points };
}

export async function getDashboardTrends(db: PrismaClient, userId: string) {
  const records = await db.gradeList.findMany({
    where: {
      userId,
      status: "ACTIVE",
      dashboardPreference: {
        is: { userId, OR: [{ includeInOverall: true }, { showOnDashboard: true }] },
      },
    },
    select: {
      id: true,
      name: true,
      periodMode: true,
      gradingSystemId: true,
      dashboardPreference: { select: { includeInOverall: true, showOnDashboard: true } },
      subjects: { where: { userId }, select: calculationSubjectSelect(userId) },
    },
  });
  const lists = [];
  for (const list of records) {
    lists.push({ ...list, entries: await readCalculationEntries(db, userId, list.id) });
  }
  const overall = new Map<string, ReturnType<typeof gradeTrend>>();
  const flat = new Map<GradingSystemId, (typeof lists)[number]["entries"]>();
  const subjects: {
    id: string;
    name: string;
    listId: string;
    listName: string;
    systemId: GradingSystemId;
    trend: ReturnType<typeof gradeTrend>;
    latest: string;
  }[] = [];
  for (const list of lists) {
    const structured =
      list.periodMode === "SEMESTERS" ||
      list.subjects.some((subject) =>
        subject.periods.some((period) => period.weightingMode === "PERCENTAGES"),
      ) ||
      list.entries.some((entry) => entry.groupId);
    if (list.dashboardPreference?.includeInOverall) {
      if (!structured) {
        flat.set(list.gradingSystemId, [
          ...(flat.get(list.gradingSystemId) ?? []),
          ...list.entries,
        ]);
      } else if (list.periodMode !== "SEMESTERS") {
        overall.set(
          list.id,
          gradeTrend(list.gradingSystemId, list.entries, (entries) =>
            calculateList({ ...list, entries }),
          ),
        );
      }
    }
    if (list.dashboardPreference?.showOnDashboard) {
      for (const subject of list.subjects) {
        let entries = list.entries.filter((entry) => entry.subjectId === subject.id);
        const latest = entries.toSorted(
          (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
        )[0];
        if (!latest) {
          continue;
        }
        const position =
          list.periodMode === "SEMESTERS"
            ? (subject.periods.find((period) => period.id === latest.subjectPeriodId)?.period
                .position ?? 0)
            : 0;
        if (list.periodMode === "SEMESTERS") {
          if (!position) {
            continue;
          }
          entries = entries.filter((entry) => entry.subjectPeriodId === latest.subjectPeriodId);
        }
        subjects.push({
          id: subject.id,
          name: subject.name,
          listId: list.id,
          listName: list.name,
          systemId: list.gradingSystemId,
          latest: latest.date,
          trend: gradeTrend(
            list.gradingSystemId,
            entries,
            structured ? (values) => calculateSubject(list, subject, values, position) : undefined,
          ),
        });
      }
    }
  }
  for (const [systemId, entries] of flat) {
    overall.set(systemId, gradeTrend(systemId, entries));
  }
  return {
    overall,
    subjects: subjects.sort((a, b) => b.latest.localeCompare(a.latest)).slice(0, 3),
  };
}
