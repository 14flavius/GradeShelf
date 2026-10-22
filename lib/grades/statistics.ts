import type { PrismaClient } from "@/generated/prisma/client";
import { overallAverages, weightedAverage } from "./averages.ts";

// Server-side caller supplies the authenticated user ID. No role bypass or client owner ID.
export async function getListStatistics(db: PrismaClient, userId: string) {
  const lists = await db.gradeList.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      gradingSystemId: true,
      gradingSystemLockedAt: true,
      status: true,
      isDefault: true,
      dashboardPreference: { select: { includeInOverall: true, showOnDashboard: true } },
      entries: { where: { userId, grade: { not: null } }, select: { grade: true, weight: true } },
      _count: { select: { subjects: { where: { userId } }, entries: { where: { userId } } } },
    },
  });
  return {
    lists: lists.map(({ entries, dashboardPreference, ...list }) => ({
      ...list,
      visibleOnDashboard: list.status === "ACTIVE" && dashboardPreference?.showOnDashboard === true,
      includedInOverall: list.status === "ACTIVE" && dashboardPreference?.includeInOverall === true,
      average: weightedAverage(list.gradingSystemId, entries),
    })),
    overall: overallAverages(lists),
  };
}
