import type { Prisma } from "../../generated/prisma/client.ts";

function subjectPeriodSelect(userId: string) {
  return {
    id: true,
    enrolled: true,
    weightingMode: true,
    finalGrade: true,
    period: { select: { position: true } },
    shares: { where: { userId }, select: { gradeTypeId: true, share: true } },
    groups: {
      where: { userId },
      select: { id: true, gradeTypeId: true, name: true, weight: true },
    },
  } satisfies Prisma.SubjectPeriodSelect;
}

export function calculationSubjectSelect(userId: string) {
  return {
    id: true,
    name: true,
    color: true,
    isAdvanced: true,
    periods: {
      where: { userId },
      orderBy: { period: { position: "asc" } },
      select: subjectPeriodSelect(userId),
    },
  } satisfies Prisma.SubjectSelect;
}

export const calculationEntrySelect = {
  subjectId: true,
  gradeTypeId: true,
  grade: true,
  weight: true,
  subjectPeriodId: true,
  groupId: true,
  group: { select: { id: true, name: true, weight: true } },
} satisfies Prisma.GradeEntrySelect;

export async function readCalculationEntries(
  db: import("../../generated/prisma/client.ts").PrismaClient,
  userId: string,
  gradeListId: string,
) {
  const entries = [];
  let after: string | undefined;
  while (true) {
    const batch = await db.gradeEntry.findMany({
      where: { userId, gradeListId, grade: { not: null }, ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: "asc" },
      take: 200,
      select: {
        ...calculationEntrySelect,
        id: true,
        title: true,
        date: true,
        gradedAt: true,
        gradeText: true,
        subject: { select: { name: true } },
      },
    });
    entries.push(...batch);
    if (batch.length < 200) {
      return entries;
    }
    after = batch[batch.length - 1].id;
  }
}
