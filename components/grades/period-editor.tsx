"use client";

import { formatGrade } from "@/lib/grades/systems";
import { useState, type SubmitEvent } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { calculateSubject, formatAverage, type CalculationEntry } from "@/lib/grades/averages";
import {
  gradeInputSchema,
  subjectPeriodInputSchema,
  gradeGroupInputSchema,
} from "@/lib/grades/validation";
import { periodLabel } from "@/lib/grades/periods";
import type { ListChoice, PeriodChoice, TypeChoice } from "@/lib/grades/types";
import { FormField, MutationError } from "./form-parts";
import { WeightingFields } from "./weighting-fields";
import { parseWeightingShares } from "@/lib/grades/weighting";
import { useGradeMutation } from "./use-grade-mutation";

type Props = {
  list: ListChoice;
  subject: ListChoice["subjects"][number];
  period: PeriodChoice;
  types: TypeChoice[];
  entries: CalculationEntry[];
};

export function PeriodEditor(props: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t.periodSettings}
      </Button>
      {open && <PeriodForm {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function PeriodForm({
  list,
  subject,
  period,
  types,
  entries,
  onClose,
}: Props & { onClose: () => void }) {
  const { t, locale } = useLanguage();
  const mutation = useGradeMutation();
  const [mode, setMode] = useState(period.weightingMode);
  const [shares, setShares] = useState<Record<string, string>>(
    Object.fromEntries(
      period.shares.map((item) => [
        item.gradeTypeId,
        new Intl.NumberFormat(locale).format(item.share / 100),
      ]),
    ),
  );
  const [enrolled, setEnrolled] = useState(period.enrolled);
  const available = types.filter(
    (type) =>
      list.useAllGradeTypes ||
      list.gradeTypes.some((item) => item.gradeTypeId === type.id) ||
      period.shares.some((item) => item.gradeTypeId === type.id),
  );
  const parsedShares = parseWeightingShares(
    shares,
    available.map((type) => type.id),
  );
  const total = parsedShares.reduce((sum, item) => sum + item.share, 0);
  const weightingEnabled = list.periodMode !== "SCHOOL_YEAR" || period.period.position === 0;
  const before = calculateSubject(list, subject, entries, period.period.position);
  const candidate = { ...period, weightingMode: mode, shares: parsedShares };
  const after = calculateSubject(
    list,
    {
      ...subject,
      periods: subject.periods.map((item) => (item.id === period.id ? candidate : item)),
    },
    entries,
    period.period.position,
  );
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const final = gradeInputSchema(list.gradingSystemId).safeParse(form.get("finalGrade"));
    if (!final.success) {
      mutation.invalid();
      return;
    }
    const parsed = subjectPeriodInputSchema.safeParse({
      enrolled,
      weightingMode: mode,
      shares: mode === "PERCENTAGES" ? parsedShares : [],
      finalGrade: final.data,
    });
    if (!parsed.success) {
      mutation.invalid();
      return;
    }
    if (await mutation.run({ action: "period.update", id: period.id, data: parsed.data })) {
      onClose();
    }
  }
  return (
    <Dialog
      title={`${t.periodSettings} · ${periodLabel(period.period.position, t)}`}
      onClose={onClose}
      busy={mutation.pending}
    >
      <form className="space-y-4" onSubmit={submit}>
        <fieldset disabled={mutation.pending} className="space-y-4">
          {period.period.position > 0 && (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                name="enrolled"
                type="checkbox"
                checked={enrolled}
                onChange={(event) => setEnrolled(event.target.checked)}
                className="size-5 accent-primary"
              />
              {t.enrolled}
            </label>
          )}
          {weightingEnabled ? (
            <>
              <WeightingFields
                value={{ weightingMode: mode, shares }}
                types={available}
                onChange={(value) => {
                  setMode(value.weightingMode);
                  setShares(value.shares);
                }}
              />
              <p className="rounded-xl bg-muted p-3 text-sm">
                {t.calculationPreview}:{" "}
                {before.value === null ? "—" : formatAverage(before.value, locale)} →{" "}
                {after.value === null ? "—" : formatAverage(after.value, locale)}
                {after.incomplete ? ` · ${t.incompleteAverage}` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t.periodYearWeights}</p>
          )}
          <FormField label={t.finalGrade}>
            <Input
              name="finalGrade"
              inputMode="decimal"
              defaultValue={
                period.finalGrade === null
                  ? ""
                  : formatGrade(period.finalGrade, list.gradingSystemId, locale)
              }
            />
          </FormField>
          <p className="text-sm text-muted-foreground">{t.finalGradeHelp}</p>
        </fieldset>
        <MutationError message={mutation.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.pending}>
            {t.cancel}
          </Button>
          <Button
            type="submit"
            disabled={mutation.pending || (mode === "PERCENTAGES" && total !== 10000)}
          >
            {mutation.pending ? t.saving : t.save}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function GroupEditor({
  group,
  periodId,
  label,
}: {
  group: PeriodChoice["groups"][number];
  periodId: string;
  label?: string;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const mutation = useGradeMutation();
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = gradeGroupInputSchema.safeParse({
      subjectPeriodId: periodId,
      gradeTypeId: group.gradeTypeId,
      name: form.get("name"),
      weight: form.get("weight"),
    });
    if (!parsed.success) {
      mutation.invalid();
      return;
    }
    if (await mutation.run({ action: "group.update", id: group.id, data: parsed.data })) {
      setOpen(false);
    }
  }
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {label ?? group.name}
      </Button>
      {open && (
        <Dialog title={t.gradeGroup} onClose={() => setOpen(false)} busy={mutation.pending}>
          <form className="space-y-4" onSubmit={submit}>
            <FormField label={t.groupName}>
              <Input name="name" required maxLength={120} defaultValue={group.name} />
            </FormField>
            <FormField label={t.groupWeight}>
              <Input name="weight" inputMode="decimal" required defaultValue={group.weight} />
            </FormField>
            <p className="text-sm text-muted-foreground">{t.groupHelp}</p>
            <MutationError message={mutation.error} />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                disabled={mutation.pending}
                onClick={() => setOpen(false)}
              >
                {t.cancel}
              </Button>
              <Button type="submit" disabled={mutation.pending}>
                {t.save}
              </Button>
            </div>
            <details className="border-t pt-3 text-sm">
              <summary className="cursor-pointer">{t.groupRemove}</summary>
              <p className="my-3 text-muted-foreground">{t.groupRemoveHelp}</p>
              <Button
                variant="secondary"
                disabled={mutation.pending}
                onClick={async () => {
                  if (await mutation.run({ action: "group.delete", id: group.id })) {
                    setOpen(false);
                  }
                }}
              >
                {t.groupRemove}
              </Button>
            </details>
          </form>
        </Dialog>
      )}
    </>
  );
}
