import type { GradingSystemId, Prisma, PrismaClient } from "@/generated/prisma/client";
import { formatAverage, weightedAverage } from "./averages.ts";
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
export function gradeTrend(systemId: GradingSystemId, entries: readonly TrendEntry[]) {
  const ordered = entries
    .filter((entry): entry is TrendEntry & { grade: number } => entry.grade !== null)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        recordedTime(a) - recordedTime(b) ||
        a.id.localeCompare(b.id),
    );
  const start = Math.max(0, ordered.length - windowSize);
  const points = ordered.slice(start).map((entry, index) => {
    const position = start + index + 1;
    const windowStart = Math.max(0, position - windowSize);
    const value = weightedAverage(systemId, ordered.slice(windowStart, position)).value;
    if (value === null) {
      throw new Error("TREND_AVERAGE_EMPTY");
    }
    return {
      id: entry.id,
      title: entry.title ?? "",
      subjectName: entry.subject?.name ?? "",
      date: entry.date,
      grade: entry.grade,
      weight: entry.weight,
      position,
      firstPosition: windowStart + 1,
      value,
    };
  });
  const current = points.at(-1)?.value ?? null;
  if (current === null || points.length < 2) {
    return { status: "INSUFFICIENT" as const, current, difference: null, points };
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
  return { status, current, difference, points };
}

const newestFirst = [
  { date: "desc" },
  { gradedAt: "desc" },
  { id: "desc" },
] satisfies Prisma.GradeEntryOrderByWithRelationInput[];

async function readRecentTrend(
  db: PrismaClient,
  userId: string,
  systemId: GradingSystemId,
  filter: Prisma.GradeEntryWhereInput,
) {
  const where = { ...filter, userId, grade: { not: null } };
  // Ten visible points need at most nineteen grades, including their rolling history.
  // Loading every grade with relations can exceed SQLite's query parameter limit.
  const [entries, total] = await db.$transaction([
    db.gradeEntry.findMany({
      where,
      orderBy: newestFirst,
      take: windowSize * 2 - 1,
      select: {
        id: true,
        title: true,
        date: true,
        gradedAt: true,
        grade: true,
        weight: true,
        subject: { select: { name: true } },
      },
    }),
    db.gradeEntry.count({ where }),
  ]);
  const trend = gradeTrend(systemId, entries);
  const offset = total - entries.length;
  return {
    ...trend,
    points: trend.points.map((point) => ({
      ...point,
      position: point.position + offset,
      firstPosition: point.firstPosition + offset,
    })),
  };
}

export async function getDashboardTrends(db: PrismaClient, userId: string) {
  const overallLists = {
    userId,
    status: "ACTIVE",
    dashboardPreference: { is: { userId, includeInOverall: true } },
  } satisfies Prisma.GradeListWhereInput;
  const systems = await db.gradeList.findMany({
    where: overallLists,
    distinct: ["gradingSystemId"],
    select: { gradingSystemId: true },
  });
  const overall = new Map<GradingSystemId, ReturnType<typeof gradeTrend>>();
  for (const { gradingSystemId } of systems) {
    overall.set(
      gradingSystemId,
      await readRecentTrend(db, userId, gradingSystemId, {
        gradeList: { ...overallLists, gradingSystemId },
      }),
    );
  }

  const visibleLists = {
    userId,
    status: "ACTIVE",
    dashboardPreference: { is: { userId, showOnDashboard: true } },
  } satisfies Prisma.GradeListWhereInput;
  const subjects: {
    id: string;
    name: string;
    listId: string;
    listName: string;
    systemId: GradingSystemId;
    trend: ReturnType<typeof gradeTrend>;
  }[] = [];
  // Find the three most recently examined subjects, even if one dominates recent grades.
  for (let index = 0; index < 3; index++) {
    const latest = await db.gradeEntry.findFirst({
      where: {
        userId,
        grade: { not: null },
        gradeList: visibleLists,
        subjectId: { notIn: subjects.map((subject) => subject.id) },
      },
      orderBy: newestFirst,
      select: {
        subjectId: true,
        gradeListId: true,
        subject: { select: { name: true } },
        gradeList: { select: { name: true, gradingSystemId: true } },
      },
    });
    if (!latest) {
      break;
    }
    subjects.push({
      id: latest.subjectId,
      name: latest.subject.name,
      listId: latest.gradeListId,
      listName: latest.gradeList.name,
      systemId: latest.gradeList.gradingSystemId,
      trend: await readRecentTrend(db, userId, latest.gradeList.gradingSystemId, {
        subjectId: latest.subjectId,
        gradeList: visibleLists,
      }),
    });
  }
  return { overall, subjects };
}
