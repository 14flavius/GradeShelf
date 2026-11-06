import type { GradingSystemId, PeriodMode } from "../../generated/prisma/enums.ts";

export type ListSettings = { gradingSystemId: GradingSystemId; periodMode: PeriodMode };
export const listPresets = {
  school: { gradingSystemId: "de_school_v1", periodMode: "NONE" },
  upper: { gradingSystemId: "upper_secondary_15_v1", periodMode: "SEMESTERS" },
  other: { gradingSystemId: "percent_v1", periodMode: "NONE" },
} as const satisfies Record<string, ListSettings>;
