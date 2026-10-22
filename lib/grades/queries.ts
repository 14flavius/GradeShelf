import "server-only";
import { getDb } from "@/lib/db";
import type { EntryView, ListChoice, TypeChoice } from "./types";
import { getListEntries } from "./entry-details";

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
        isDefault: true,
        gradeTypes: { where: { userId }, select: { gradeTypeId: true } },
        subjects: { where: { userId }, orderBy: { name: "asc" }, select: { id: true, name: true } },
      },
    }),
    db.gradeType.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, weight: true },
    }),
  ]);
  return { lists, types };
}

export async function getEntries(
  userId: string,
  gradeListId: string,
  subjectId?: string,
): Promise<EntryView[]> {
  const db = await getDb();
  return getListEntries(db, userId, gradeListId, subjectId);
}
