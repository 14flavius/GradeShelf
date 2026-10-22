import type { GradingSystemId } from "@/generated/prisma/enums";
import { entryStatus } from "./dates.ts";
import { z } from "zod";

export const recentGradeLimit = 5;
export const examPreviewLimit = 5;
export const recentCursorSchema = z.strictObject({
  id: z.string().min(1).max(128),
  gradedAt: z.iso.datetime().nullable(),
});
export type RecentCursor = z.infer<typeof recentCursorSchema>;
export type RecentGradePage = {
  entries: DashboardEntry[];
  nextCursor: RecentCursor | null;
  total: number;
};

export type DashboardEntry = {
  id: string;
  gradeListId: string;
  subjectId: string;
  title: string;
  date: string;
  grade: number | null;
  weight: number;
  notePreview: string | null;
  gradeList: { name: string; gradingSystemId: GradingSystemId };
  subject: { name: string };
  gradeType: { name: string };
};

export function partitionExams<T extends { id: string; date: string; grade: number | null }>(
  entries: readonly T[],
  today: string,
) {
  const upcoming: T[] = [];
  const pending: T[] = [];
  for (const entry of entries) {
    const status = entryStatus(entry.date, entry.grade, today);
    if (status === "UPCOMING") {
      upcoming.push(entry);
    } else if (status === "PENDING_GRADE") {
      pending.push(entry);
    }
  }
  // Upcoming: nearest first. Pending: oldest first so overdue entries remain visible.
  const byDate = (a: T, b: T) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
  return { upcoming: upcoming.sort(byDate), pending: pending.sort(byDate) };
}
