import "server-only";
import { calculationSubjectSelect } from "./calculation-data";
import { getDb } from "@/lib/db";
import type { EntryView, ListChoice, TypeChoice } from "./types";
import { getListEntries } from "./entry-details";
import { periodCount } from "./periods";

export async function getEntryChoices(
  userId: string,
): Promise<{ lists: ListChoice[]; types: TypeChoice[] }> {
  const db = await getDb();
  const [lists, types] = await Promise.all([
    db.gradeList.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        gradingSystemId: true,
        useAllGradeTypes: true,
        periodMode: true,
        isDefault: true,
        gradeTypes: { where: { userId }, select: { gradeTypeId: true } },
        subjects: {
          where: { userId },
          orderBy: { name: "asc" },
          select: calculationSubjectSelect(userId),
        },
      },
    }),
    db.gradeType.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, weight: true },
    }),
  ]);
  return {
    lists: lists.map((list) => ({
      ...list,
      subjects: list.subjects.map((subject) => ({
        ...subject,
        periods: subject.periods.filter(
          (period) => period.period.position <= periodCount(list.periodMode),
        ),
      })),
    })),
    types,
  };
}

export async function getEntries(
  userId: string,
  gradeListId: string,
  subjectId?: string,
): Promise<EntryView[]> {
  const db = await getDb();
  return getListEntries(db, userId, gradeListId, subjectId);
}
