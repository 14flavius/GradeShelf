"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/i18n/provider";
import type { ListChoice, TypeChoice } from "@/lib/grades/types";
import type { CalculationEntry } from "@/lib/grades/averages";
import { requiredGrade } from "@/lib/grades/targets";
import { formatGrade } from "@/lib/grades/systems";
import { weightSchema } from "@/lib/grades/validation";
import { defaultEntryWeight } from "@/lib/grades/weighting";
import { FormField, controlClass } from "./form-parts";

export function TargetCalculator({
  list,
  subject,
  entries,
  types,
  position,
}: {
  list: ListChoice;
  subject: ListChoice["subjects"][number];
  entries: CalculationEntry[];
  types: TypeChoice[];
  position: number;
}) {
  const { t, locale } = useLanguage();
  const [target, setTarget] = useState("");
  const [typeId, setTypeId] = useState("");
  const [customWeight, setCustomWeight] = useState<{ key: string; value: string } | null>(null);
  const [groupId, setGroupId] = useState("");
  const period = subject.periods.find((period) => period.period.position === position);
  const settings =
    list.periodMode === "SCHOOL_YEAR"
      ? subject.periods.find((period) => period.period.position === 0)
      : period;
  const available = types.filter(
    (type) =>
      (list.useAllGradeTypes || list.gradeTypes.some((item) => item.gradeTypeId === type.id)) &&
      (settings?.weightingMode !== "PERCENTAGES" ||
        settings.shares.some((item) => item.gradeTypeId === type.id && item.share > 0)),
  );
  const type = available.find((type) => type.id === typeId) ?? available[0];
  const weightKey = `${type?.id ?? ""}:${period?.id ?? ""}`;
  const weight =
    customWeight?.key === weightKey
      ? customWeight.value
      : String(defaultEntryWeight(type?.weight ?? 1, settings?.weightingMode));
  const groups = period?.groups.filter((group) => group.gradeTypeId === type?.id) ?? [];
  const group = groups.find((group) => group.id === groupId) ?? null;
  const parsedWeight = weightSchema.safeParse(Number(weight.replace(",", ".")));
  if (!period?.enrolled || !type || (list.periodMode !== "NONE" && position === 0)) {
    return null;
  }
  const result =
    target.trim() && parsedWeight.success
      ? requiredGrade(
          list,
          subject,
          entries,
          {
            subjectId: subject.id,
            gradeTypeId: type.id,
            subjectPeriodId: period.id,
            groupId: group?.id ?? null,
            group,
            weight: parsedWeight.data,
          },
          position,
          Number(target.replace(",", ".")),
        )
      : null;
  return (
    <details className="panel space-y-4 p-4">
      <summary className="cursor-pointer font-medium">{t.targetCalculator}</summary>
      <p className="text-sm text-muted-foreground">{t.targetHelp}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={t.targetAverage}>
          <Input
            name="targetGrade"
            inputMode="decimal"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </FormField>
        <FormField label={t.gradeType}>
          <select
            name="gradeTypeId"
            className={controlClass}
            value={type.id}
            onChange={(event) => {
              setTypeId(event.target.value);
              setGroupId("");
            }}
          >
            {available.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={t.weight}>
          <Input
            name="weight"
            inputMode="decimal"
            value={weight}
            onChange={(event) => setCustomWeight({ key: weightKey, value: event.target.value })}
          />
        </FormField>
        {groups.length > 0 && (
          <FormField label={t.gradeGroup}>
            <select
              name="groupId"
              className={controlClass}
              value={group?.id ?? ""}
              onChange={(event) => setGroupId(event.target.value)}
            >
              <option value="">{t.noGradeGroup}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </FormField>
        )}
      </div>
      {target && (
        <p role="status" className="text-sm">
          {result
            ? `${t.requiredGrade}: ${formatGrade(result.grade, list.gradingSystemId, locale)}${result.average.incomplete ? ` · ${t.incompleteAverage}` : ""}`
            : t.targetUnavailable}
        </p>
      )}
    </details>
  );
}
