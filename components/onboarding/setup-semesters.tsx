import { useLanguage } from "@/components/i18n/provider";
import { FormField, controlClass } from "@/components/grades/form-parts";
import { WeightingFields, type WeightingDraft } from "@/components/grades/weighting-fields";
import { periodLabel } from "@/lib/grades/periods";
import { parseWeightingShares } from "@/lib/grades/weighting";
import type { TypeChoice } from "@/lib/grades/types";
import type { SetupDraft } from "./setup-draft";

export function SemesterSubjectOptions({
  subject,
  onChange,
}: {
  subject: SetupDraft["subjects"][number];
  onChange: (subject: SetupDraft["subjects"][number]) => void;
}) {
  const { t } = useLanguage();
  const enrolled = subject.enrolledPeriods ?? [1, 2, 3, 4];
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <FormField label={t.setupCourseType}>
        <select
          name={`course-${subject.key}`}
          className={controlClass}
          value={subject.isAdvanced ? "advanced" : "basic"}
          onChange={(event) =>
            onChange({ ...subject, isAdvanced: event.target.value === "advanced" })
          }
        >
          <option value="basic">{t.basicCourse}</option>
          <option value="advanced">{t.advancedCourse}</option>
        </select>
      </FormField>
      <details className="rounded-xl bg-muted/40 px-3">
        <summary className="cursor-pointer py-3 text-sm">
          {t.setupEnrollment}:{" "}
          {enrolled.length === 4 ? t.setupAllSemesters : enrolled.join(", ") || "—"}
        </summary>
        <div className="grid grid-cols-2 gap-1 pb-3">
          {[1, 2, 3, 4].map((position) => (
            <label key={position} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                name={`enrolled-${subject.key}-${position}`}
                type="checkbox"
                className="size-4 accent-primary"
                checked={enrolled.includes(position)}
                onChange={(event) =>
                  onChange({
                    ...subject,
                    enrolledPeriods: event.target.checked
                      ? [...enrolled, position].sort()
                      : enrolled.filter((item) => item !== position),
                  })
                }
              />
              {periodLabel(position, t)}
            </label>
          ))}
        </div>
        {enrolled.length === 0 && (
          <p role="alert" className="pb-3 text-sm text-destructive">
            {t.setupEnrollmentInvalid}
          </p>
        )}
      </details>
    </div>
  );
}

export function SemesterWeighting({
  draft,
  types,
  onChange,
}: {
  draft: SetupDraft;
  types: TypeChoice[];
  onChange: (draft: SetupDraft) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-5 border-t border-border pt-5">
      <div className="space-y-3 rounded-2xl bg-muted/40 p-4">
        <h3 className="font-medium">{t.setupCommonWeighting}</h3>
        <p className="text-sm text-muted-foreground">{t.setupCommonWeightingHelp}</p>
        <WeightingFields
          value={draft.semesterWeighting}
          types={types}
          name="setup-weighting"
          onChange={(semesterWeighting) => onChange({ ...draft, semesterWeighting })}
        />
      </div>
      <details
        className="rounded-2xl border border-border p-4"
        open={draft.subjects.some((subject) => subject.weighting) || undefined}
      >
        <summary className="cursor-pointer text-sm font-medium">
          {t.setupWeightingExceptions}
        </summary>
        <p className="mt-3 text-sm text-muted-foreground">{t.setupWeightingExceptionsHelp}</p>
        <div className="mt-3 space-y-3">
          {draft.subjects.map((subject) => (
            <div key={subject.key} className="space-y-3 rounded-xl bg-muted/40 p-3">
              <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                <input
                  name={`custom-weighting-${subject.key}`}
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={!!subject.weighting}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      subjects: draft.subjects.map((item) =>
                        item.key === subject.key
                          ? {
                              ...item,
                              weighting: event.target.checked
                                ? {
                                    ...draft.semesterWeighting,
                                    shares: { ...draft.semesterWeighting.shares },
                                  }
                                : undefined,
                            }
                          : item,
                      ),
                    })
                  }
                />
                {subject.name || t.subject} · {t.setupCustomWeighting}
              </label>
              {subject.weighting && (
                <WeightingFields
                  value={subject.weighting}
                  types={types}
                  name={`setup-weighting-${subject.key}`}
                  onChange={(weighting) =>
                    onChange({
                      ...draft,
                      subjects: draft.subjects.map((item) =>
                        item.key === subject.key ? { ...item, weighting } : item,
                      ),
                    })
                  }
                />
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

export function SetupWeightingSummary({
  value,
  types,
}: {
  value: WeightingDraft;
  types: TypeChoice[];
}) {
  const { t, locale } = useLanguage();
  const format = new Intl.NumberFormat(locale);
  const shares = parseWeightingShares(
    value.shares,
    types.map((type) => type.id),
  );
  return (
    <div className="space-y-1 text-sm">
      <p>{value.weightingMode === "PERCENTAGES" ? t.weightPercentages : t.weightEntries}</p>
      <ul className="space-y-1 text-muted-foreground">
        {types.map((type) => (
          <li key={type.id} className="flex justify-between gap-3">
            <span className="min-w-0 break-words">{type.name}</span>
            <span className="shrink-0">
              {value.weightingMode === "PERCENTAGES"
                ? `${format.format((shares.find((share) => share.gradeTypeId === type.id)?.share ?? 0) / 100)} %`
                : `× ${format.format(type.weight)}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
