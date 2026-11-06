import type { AttachmentView } from "../attachments/rules.ts";
import type { PeriodMode, GradingSystemId } from "@/generated/prisma/enums";

export type ListChoice = {
  id: string;
  name: string;
  gradingSystemId: GradingSystemId;
  periodMode: PeriodMode;
  useAllGradeTypes: boolean;
  isDefault: boolean;
  gradeTypes: { gradeTypeId: string }[];
  subjects: { id: string; name: string; periods: PeriodChoice[] }[];
};
export type TypeChoice = { id: string; name: string; weight: number };
export type EntryView = {
  id: string;
  gradeListId: string;
  subjectId: string;
  gradeTypeId: string;
  subjectPeriodId: string | null;
  groupId: string | null;
  group: { id: string; name: string; weight: number } | null;
  subjectPeriod: { period: { position: number } } | null;
  gradeText: string | null;
  title: string;
  date: string;
  gradedAt?: Date | string | null;
  grade: number | null;
  weight: number;
  note: string | null;
  attachments: AttachmentView[];
  subject: { name: string };
  gradeType: { name: string };
  gradeList: { gradingSystemId: GradingSystemId; periodMode: PeriodMode };
};

export type PeriodChoice = {
  id: string;
  period: { position: number };
  enrolled: boolean;
  weightingMode: "ENTRIES" | "PERCENTAGES";
  finalGrade: number | null;
  shares: { gradeTypeId: string; share: number }[];
  groups: { id: string; name: string; weight: number; gradeTypeId: string }[];
};
