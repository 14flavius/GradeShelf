import type { PrismaClient } from "@/generated/prisma/client";
import { readCalculationEntries, calculationSubjectSelect } from "./calculation-data.ts";
import { overallAverages, calculateList } from "./averages.ts";

// Server-side caller supplies the authenticated user ID. No role bypass or client owner ID.
export async function getListStatistics(db: PrismaClient, userId: string) {
  const records = await db.gradeList.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      gradingSystemId: true,
      gradingSystemLockedAt: true,
      status: true,
      periodMode: true,
      subjects: { where: { userId }, select: calculationSubjectSelect(userId) },
      isDefault: true,
      dashboardPreference: { select: { includeInOverall: true, showOnDashboard: true } },
      _count: { select: { subjects: { where: { userId } }, entries: { where: { userId } } } },
    },
  });
  const lists = [];
  for (const list of records) {
    lists.push({ ...list, entries: await readCalculationEntries(db, userId, list.id) });
  }
  return {
    lists: lists.map(({ entries, dashboardPreference, ...list }) => ({
      ...list,
      visibleOnDashboard: list.status === "ACTIVE" && dashboardPreference?.showOnDashboard === true,
      includedInOverall: list.status === "ACTIVE" && dashboardPreference?.includeInOverall === true,
      average: calculateList({ ...list, entries }),
    })),
    overall: overallAverages(lists),
  };
}
