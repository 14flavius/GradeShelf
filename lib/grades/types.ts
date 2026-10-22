import type { AttachmentView } from "../attachments/rules.ts";
import type { GradingSystemId } from "@/generated/prisma/enums";

export type ListChoice = {
  id: string;
  name: string;
  gradingSystemId: GradingSystemId;
  useAllGradeTypes: boolean;
  isDefault: boolean;
  gradeTypes: { gradeTypeId: string }[];
  subjects: { id: string; name: string }[];
};
export type TypeChoice = { id: string; name: string; weight: number };
export type EntryView = {
  id: string;
  gradeListId: string;
  subjectId: string;
  gradeTypeId: string;
  title: string;
  date: string;
  gradedAt?: Date | string | null;
  grade: number | null;
  weight: number;
  note: string | null;
  attachments: AttachmentView[];
  subject: { name: string };
  gradeType: { name: string };
  gradeList: { gradingSystemId: GradingSystemId };
};
