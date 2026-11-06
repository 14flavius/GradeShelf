import type { Prisma, PeriodMode } from "../../generated/prisma/client.ts";
import { periodCount } from "./periods.ts";

// Called in the same transaction as list/subject creation. Existing period settings
// are never overwritten when a list gains another period.
export async function ensurePeriods(
  tx: Prisma.TransactionClient,
  list: { id: string; userId: string; periodMode: PeriodMode },
) {
  const subjects = await tx.subject.findMany({
    where: { userId: list.userId, gradeListId: list.id },
    select: { id: true },
  });
  for (let position = 0; position <= periodCount(list.periodMode); position++) {
    const period = await tx.gradePeriod.upsert({
      where: {
        gradeListId_position_userId: { gradeListId: list.id, position, userId: list.userId },
      },
      create: { gradeListId: list.id, userId: list.userId, position },
      update: {},
    });
    for (const subject of subjects) {
      const existing = await tx.subjectPeriod.findUnique({
        where: {
          subjectId_periodId_userId: {
            subjectId: subject.id,
            periodId: period.id,
            userId: list.userId,
          },
        },
      });
      if (existing) {
        continue;
      }
      const template =
        position > 0 && list.periodMode === "SEMESTERS"
          ? await tx.subjectPeriod.findFirst({
              where: { subjectId: subject.id, userId: list.userId, period: { position: 0 } },
              include: { shares: true },
            })
          : null;
      const created = await tx.subjectPeriod.create({
        data: {
          subjectId: subject.id,
          periodId: period.id,
          userId: list.userId,
          gradeListId: list.id,
          weightingMode: template?.weightingMode ?? "ENTRIES",
        },
      });
      if (template?.shares.length) {
        await tx.subjectGradeType.createMany({
          data: template.shares.map((share) => ({
            subjectPeriodId: created.id,
            userId: list.userId,
            gradeTypeId: share.gradeTypeId,
            share: share.share,
          })),
        });
      }
    }
  }
}
