import type { GradingSystemId, PeriodMode } from "@/generated/prisma/enums";
import type { MessageKey } from "@/lib/i18n/messages";
import type { TypeChoice } from "@/lib/grades/types";
import { parseWeightingShares } from "@/lib/grades/weighting";
import type { WeightingDraft } from "@/components/grades/weighting-fields";

export type SetupDraft = {
  name: string;
  gradingSystemId: GradingSystemId;
  periodMode: PeriodMode;
  currentPeriod: number;
  semesterWeighting: WeightingDraft;
  subjects: {
    key: number;
    name: string;
    suggestedName?: MessageKey;
    isAdvanced?: boolean;
    enrolledPeriods?: number[];
    weighting?: WeightingDraft;
  }[];
  types: {
    key: number;
    name: string;
    weight: string;
    suggestedName?: MessageKey;
    suggestedWeight?: boolean;
  }[];
  existingTypeIds: string[];
  showOnDashboard: boolean;
  includeInOverall: boolean;
};

export function setupUsesEntryWeights(draft: SetupDraft) {
  return (
    draft.periodMode !== "SEMESTERS" ||
    draft.semesterWeighting.weightingMode === "ENTRIES" ||
    draft.subjects.some((subject) => subject.weighting?.weightingMode === "ENTRIES")
  );
}

export function selectedSetupTypes(draft: SetupDraft, available: TypeChoice[]): TypeChoice[] {
  return [
    ...draft.existingTypeIds.flatMap((id) => {
      const type = available.find((item) => item.id === id);
      return type ? [{ ...type, id: `existing:${id}` }] : [];
    }),
    ...draft.types.map((type) => ({
      id: `new:${type.key}`,
      name: type.name,
      weight: Number(type.weight.replace(",", ".")),
    })),
  ];
}

export function setupWeightingInput(value: WeightingDraft, draft: SetupDraft) {
  const ids = [
    ...draft.existingTypeIds.map((id) => `existing:${id}`),
    ...draft.types.map((type) => `new:${type.key}`),
  ];
  return {
    weightingMode: value.weightingMode,
    shares:
      value.weightingMode === "ENTRIES"
        ? []
        : parseWeightingShares(value.shares, ids).map((item) => ({
            typeIndex: ids.indexOf(item.gradeTypeId),
            share: item.share,
          })),
  };
}

export function setupSubjectsInput(draft: SetupDraft, includeWeighting = true) {
  return draft.subjects.map((subject) => ({
    name: subject.name,
    ...(draft.periodMode === "SEMESTERS"
      ? {
          isAdvanced: subject.isAdvanced ?? false,
          enrolledPeriods: subject.enrolledPeriods ?? [1, 2, 3, 4],
          ...(includeWeighting && subject.weighting
            ? { weighting: setupWeightingInput(subject.weighting, draft) }
            : {}),
        }
      : {}),
  }));
}
