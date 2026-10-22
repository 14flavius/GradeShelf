import { useRef } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField, controlClass } from "@/components/grades/form-parts";
import { gradingSystems } from "@/lib/grades/systems";
import type { GradingSystemId } from "@/generated/prisma/enums";
import type { MessageKey } from "@/lib/i18n/messages";
import type { TypeChoice } from "@/lib/grades/types";
import { TypeChecklist } from "@/components/grades/type-checklist";

export type SetupDraft = {
  name: string;
  gradingSystemId: GradingSystemId | "";
  subjects: { key: number; name: string; suggestedName?: MessageKey }[];
  types: { key: number; name: string; weight: string; suggestedName?: MessageKey }[];
  existingTypeIds: string[];
  showOnDashboard: boolean;
  includeInOverall: boolean;
};
type Props = {
  draft: SetupDraft;
  onChange: (draft: SetupDraft) => void;
  availableTypes: TypeChoice[];
};

export function SetupFields({ step, draft, onChange, availableTypes }: Props & { step: number }) {
  const { t } = useLanguage();
  const nextKey = useRef(
    Math.max(0, ...draft.subjects.map(({ key }) => key), ...draft.types.map(({ key }) => key)) + 1,
  );
  const focusNewField = useRef(false);
  function focusAddedField(element: HTMLInputElement | null) {
    if (element && focusNewField.current) {
      focusNewField.current = false;
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        element.focus();
      }
    }
  }
  function addSubject(suggestedName?: MessageKey) {
    const name = suggestedName ? t[suggestedName] : "";
    focusNewField.current = !name;
    const empty = draft.subjects.findIndex((subject) => !subject.name.trim());
    onChange({
      ...draft,
      subjects:
        empty >= 0 && name
          ? draft.subjects.map((subject, index) =>
              index === empty ? { ...subject, name, suggestedName } : subject,
            )
          : [...draft.subjects, { key: nextKey.current++, name, suggestedName }],
    });
  }
  if (step === 1) {
    return (
      <div className="space-y-6">
        <FormField label={t.name}>
          <Input
            name="setup-list"
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder={t.tutorialListPlaceholder}
            required
            maxLength={120}
            autoComplete="off"
          />
        </FormField>
        <FormField label={t.gradingSystem}>
          <select
            name="setup-system"
            className={controlClass}
            required
            value={draft.gradingSystemId}
            onChange={(event) => {
              const id = event.target.value;
              if (Object.hasOwn(gradingSystems, id)) {
                onChange({ ...draft, gradingSystemId: id as GradingSystemId });
              }
            }}
          >
            <option disabled value="">
              {t.choose}
            </option>
            {Object.entries(gradingSystems).map(([id, system]) => (
              <option value={id} key={id}>
                {t[system.labelKey]}
              </option>
            ))}
          </select>
        </FormField>
        <p className="text-xs leading-relaxed text-muted-foreground">{t.scaleHelp}</p>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="space-y-5">
        <div className="space-y-3">
          {draft.subjects.map((subject, index) => (
            <div key={subject.key} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <label className="min-w-0 flex-1">
                <span className="sr-only">
                  {t.subject} {index + 1}
                </span>
                <Input
                  name={`setup-subject-${index}`}
                  ref={index === draft.subjects.length - 1 ? focusAddedField : undefined}
                  required
                  maxLength={120}
                  placeholder={t.tutorialSubjectPlaceholder}
                  value={subject.name}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      subjects: draft.subjects.map((item) =>
                        item.key === subject.key
                          ? { ...item, name: event.target.value, suggestedName: undefined }
                          : item,
                      ),
                    })
                  }
                />
              </label>
              <RemoveButton
                label={`${t.tutorialRemove}: ${subject.name || `${t.subject} ${index + 1}`}`}
                onClick={() =>
                  onChange({
                    ...draft,
                    subjects: draft.subjects.filter((item) => item.key !== subject.key),
                  })
                }
              />
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          disabled={draft.subjects.length >= 20}
          onClick={() => addSubject()}
        >
          + {t.tutorialAddSubject}
        </Button>
        <div className="space-y-3 pt-3">
          <p className="text-xs text-muted-foreground">{t.tutorialSuggestions}</p>
          <div className="flex flex-wrap gap-2">
            {(
              ["tutorialMath", "tutorialEnglish", "tutorialScience", "tutorialProgramming"] as const
            ).map((suggestedName) => (
              <button
                key={suggestedName}
                type="button"
                className="min-h-10 rounded-full bg-muted/50 px-4 py-2 text-xs transition-colors hover:bg-accent disabled:opacity-40"
                disabled={
                  draft.subjects.length >= 20 ||
                  draft.subjects.some(
                    (subject) =>
                      subject.name.trim().toLowerCase() === t[suggestedName].toLowerCase(),
                  )
                }
                onClick={() => addSubject(suggestedName)}
              >
                + {t[suggestedName]}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {availableTypes.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t.sharedGradeTypesHelp}</p>
          <TypeChecklist
            types={availableTypes}
            selectedIds={draft.existingTypeIds}
            onChange={(existingTypeIds) => onChange({ ...draft, existingTypeIds })}
          />
        </div>
      )}
      {draft.types.length > 0 && <h3 className="text-sm font-medium">{t.newGradeTypes}</h3>}
      <div className="space-y-5">
        {draft.types.map((type, index) => (
          <div
            key={type.key}
            className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-end gap-x-2 gap-y-3 sm:grid-cols-[minmax(0,1fr)_7rem_2.75rem]"
          >
            <FormField label={`${t.gradeType} ${index + 1}`}>
              <Input
                name={`setup-type-${index}`}
                ref={index === draft.types.length - 1 ? focusAddedField : undefined}
                required
                maxLength={120}
                value={type.name}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    types: draft.types.map((item) =>
                      item.key === type.key
                        ? { ...item, name: event.target.value, suggestedName: undefined }
                        : item,
                    ),
                  })
                }
              />
            </FormField>
            <div className="order-3 col-span-2 rounded-xl bg-muted/40 px-3 py-2 sm:order-none sm:col-span-1 sm:bg-transparent sm:p-0 [&>label]:grid-cols-[minmax(0,1fr)_6rem] [&>label]:items-center sm:[&>label]:grid-cols-1">
              <FormField label={t.weight}>
                <Input
                  name={`setup-weight-${index}`}
                  required
                  maxLength={12}
                  inputMode="decimal"
                  value={type.weight}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      types: draft.types.map((item) =>
                        item.key === type.key ? { ...item, weight: event.target.value } : item,
                      ),
                    })
                  }
                />
              </FormField>
            </div>
            <RemoveButton
              label={`${t.tutorialRemove}: ${type.name || `${t.gradeType} ${index + 1}`}`}
              onClick={() =>
                onChange({ ...draft, types: draft.types.filter((item) => item.key !== type.key) })
              }
            />
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        disabled={draft.types.length >= 10}
        onClick={() => {
          focusNewField.current = true;
          onChange({
            ...draft,
            types: [...draft.types, { key: nextKey.current++, name: "", weight: "1" }],
          });
        }}
      >
        + {t.tutorialAddType}
      </Button>
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="m6 6 12 12M6 18 18 6" />
      </svg>
    </button>
  );
}

export function SetupSummary({ draft, onChange, availableTypes }: Props) {
  const { t, locale } = useLanguage();
  const format = new Intl.NumberFormat(locale);
  const selectedTypes = [
    ...availableTypes
      .filter((type) => draft.existingTypeIds.includes(type.id))
      .map((type) => ({ key: type.id, name: type.name, weight: type.weight })),
    ...draft.types.map((type) => ({
      key: `new-${type.key}`,
      name: type.name,
      weight: Number(type.weight.replace(",", ".")),
    })),
  ];
  return (
    <div className="space-y-6">
      <div className="space-y-5 rounded-2xl bg-muted/50 p-5 sm:p-6">
        <div>
          <h3 className="break-words text-xl font-semibold [overflow-wrap:anywhere]">
            {draft.name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {draft.gradingSystemId && t[gradingSystems[draft.gradingSystemId].labelKey]}
          </p>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">{t.subjects}</h4>
          <ul className="flex flex-wrap gap-2">
            {draft.subjects.map((subject) => (
              <li
                key={subject.key}
                className="max-w-full break-words rounded-lg bg-card px-3 py-1.5 text-sm [overflow-wrap:anywhere]"
              >
                {subject.name}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">{t.gradeTypes}</h4>
          <ul className="space-y-2">
            {selectedTypes.map((type) => (
              <li key={type.key} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">{type.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  × {format.format(type.weight)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="space-y-1">
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-primary"
            checked={draft.showOnDashboard}
            onChange={(event) => onChange({ ...draft, showOnDashboard: event.target.checked })}
          />
          {t.showOnDashboard}
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-primary"
            checked={draft.includeInOverall}
            onChange={(event) => onChange({ ...draft, includeInOverall: event.target.checked })}
          />
          {t.includeInOverall}
        </label>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t.tutorialAdditive}</p>
    </div>
  );
}
