import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  recentGradeLimit,
  type DashboardEntry,
  type RecentCursor,
  type RecentGradePage,
} from "./dashboard.ts";
import { getListStatistics } from "./statistics.ts";

const summarySelect = {
  id: true,
  gradeListId: true,
  subjectId: true,
  title: true,
  date: true,
  grade: true,
  weight: true,
  note: true,
  gradeList: { select: { name: true, gradingSystemId: true } },
  subject: { select: { name: true } },
  gradeType: { select: { name: true } },
} satisfies Prisma.GradeEntrySelect;

function withNotePreview({
  note,
  ...entry
}: Prisma.GradeEntryGetPayload<{ select: typeof summarySelect }>): DashboardEntry {
  const characters = Array.from(note?.trim() ?? "");
  return {
    ...entry,
    notePreview: characters.length
      ? characters.slice(0, 500).join("") + (characters.length > 500 ? "…" : "")
      : null,
  };
}

function visibleEntries(userId: string): Prisma.GradeEntryWhereInput {
  return {
    userId,
    gradeList: {
      userId,
      status: "ACTIVE",
      dashboardPreference: { is: { userId, showOnDashboard: true } },
    },
  };
}

export async function getRecentGrades(
  db: PrismaClient,
  userId: string,
  cursor?: RecentCursor,
): Promise<RecentGradePage> {
  const where = { ...visibleEntries(userId), grade: { not: null } };
  // Compare values, not a database cursor lookup: deleted cursor entries still work,
  // and all page boundaries stay inside the authenticated user's visible lists.
  const after: Prisma.GradeEntryWhereInput = !cursor
    ? {}
    : cursor.gradedAt === null
      ? { gradedAt: null, id: { gt: cursor.id } }
      : {
          OR: [
            { gradedAt: { lt: new Date(cursor.gradedAt) } },
            { gradedAt: new Date(cursor.gradedAt), id: { gt: cursor.id } },
            { gradedAt: null },
          ],
        };
  const [rows, total] = await db.$transaction([
    db.gradeEntry.findMany({
      where: { ...where, ...after },
      select: { ...summarySelect, gradedAt: true },
      orderBy: [{ gradedAt: "desc" }, { id: "asc" }],
      take: recentGradeLimit + 1,
    }),
    db.gradeEntry.count({ where }),
  ]);
  const page = rows.slice(0, recentGradeLimit);
  const last = page.at(-1);
  return {
    entries: page.map(({ gradedAt, ...entry }) => {
      void gradedAt;
      return withNotePreview(entry);
    }),
    nextCursor:
      rows.length > recentGradeLimit && last
        ? { id: last.id, gradedAt: last.gradedAt?.toISOString() ?? null }
        : null,
    total,
  };
}

export async function getDashboardData(db: PrismaClient, userId: string) {
  const [statistics, exams, recent] = await Promise.all([
    getListStatistics(db, userId),
    // No server timezone assumption: the browser partitions these calendar dates.
    db.gradeEntry.findMany({
      where: { ...visibleEntries(userId), grade: null },
      select: summarySelect,
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    getRecentGrades(db, userId),
  ]);
  return {
    hasLists: statistics.lists.length > 0,
    lists: statistics.lists.filter((list) => list.visibleOnDashboard),
    overall: statistics.overall,
    exams: exams.map(withNotePreview),
    recent,
  };
}
