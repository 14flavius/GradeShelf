"use client";

import { useState } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { gradingSystems, gradingSystemIdSchema } from "@/lib/grades/systems";
import { listPresets, type ListSettings } from "@/lib/grades/profiles";
import { controlClass, FormField } from "./form-parts";

export function ListSettingsFields({
  value,
  onChange,
  locked = false,
  creating = false,
  canExtend = false,
}: {
  value: ListSettings;
  onChange: (value: ListSettings) => void;
  locked?: boolean;
  creating?: boolean;
  canExtend?: boolean;
}) {
  const { t } = useLanguage();
  const [customize, setCustomize] = useState(false);
  const fields = (
    <>
      <FormField label={t.gradingSystem}>
        <select
          name="gradingSystemId"
          className={controlClass}
          value={value.gradingSystemId}
          disabled={locked}
          onChange={(event) => {
            const id = gradingSystemIdSchema.safeParse(event.target.value);
            if (id.success) {
              onChange({ ...value, gradingSystemId: id.data });
            }
          }}
        >
          {Object.entries(gradingSystems).map(([id, system]) => (
            <option key={id} value={id}>
              {t[system.labelKey]}
            </option>
          ))}
        </select>
      </FormField>
      {locked && canExtend && (
        <label className="flex items-center gap-3 text-sm">
          <input
            name="extendGradeInput"
            type="checkbox"
            className="size-4 accent-primary"
            checked={value.gradingSystemId === "de_school_extended_v1"}
            onChange={(event) =>
              onChange({
                ...value,
                gradingSystemId: event.target.checked ? "de_school_extended_v1" : "de_school_v1",
              })
            }
          />
          {t.extendGradeInput}
        </label>
      )}
      {value.gradingSystemId === "de_school_extended_v1" && (
        <p className="text-xs text-muted-foreground">{t.extendedGradeHelp}</p>
      )}
      <FormField label={t.periodMode}>
        <select
          name="periodMode"
          className={controlClass}
          value={value.periodMode}
          onChange={(event) => {
            const mode = event.target.value;
            if (mode === "NONE" || mode === "SCHOOL_YEAR" || mode === "SEMESTERS") {
              onChange({ ...value, periodMode: mode });
            }
          }}
        >
          <option value="NONE">{t.periodNone}</option>
          <option value="SCHOOL_YEAR">{t.periodYear}</option>
          <option value="SEMESTERS">{t.periodSemesters}</option>
        </select>
      </FormField>
      <p className="text-xs leading-relaxed text-muted-foreground">{t.periodModeHelp}</p>
      {!creating && (
        <p className="text-xs leading-relaxed text-muted-foreground">{t.periodChangeHelp}</p>
      )}
    </>
  );
  return (
    <div className="space-y-4">
      {creating && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{t.listPreset}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["school", "upper", "other"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                className="rounded-xl border border-border bg-muted/40 p-3 text-sm font-medium hover:bg-accent aria-pressed:border-primary aria-pressed:bg-primary/10"
                aria-pressed={
                  value.gradingSystemId === listPresets[preset].gradingSystemId &&
                  value.periodMode === listPresets[preset].periodMode
                }
                onClick={() => {
                  onChange(listPresets[preset]);
                  setCustomize(preset === "other");
                }}
              >
                {preset === "school"
                  ? t.presetSchool
                  : preset === "upper"
                    ? t.presetUpper
                    : t.presetOther}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {creating ? (
        <>
          <p className="text-sm text-muted-foreground">
            {t[gradingSystems[value.gradingSystemId].labelKey]} ·{" "}
            {value.periodMode === "SEMESTERS"
              ? t.periodSemesters
              : value.periodMode === "SCHOOL_YEAR"
                ? t.periodYear
                : t.periodNone}
          </p>
          <details
            open={customize}
            onToggle={(event) => setCustomize(event.currentTarget.open)}
            className="space-y-4"
          >
            <summary className="cursor-pointer text-sm">{t.additionalOptions}</summary>
            {fields}
          </details>
        </>
      ) : (
        fields
      )}
    </div>
  );
}
