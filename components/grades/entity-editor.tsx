"use client";

import { useState, type SubmitEvent } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { ListSettingsFields } from "./list-settings-fields";
import type { ListSettings } from "@/lib/grades/profiles";
import type { PeriodMode } from "@/generated/prisma/enums";
import { gradeCommandSchema } from "@/lib/grades/commands";
import type { GradingSystemId } from "@/generated/prisma/enums";
import { controlClass, FormField, MutationError } from "./form-parts";
import { useGradeMutation } from "./use-grade-mutation";
import { SubjectColorPicker } from "./subject-color-picker";

type EditorProps =
  | {
      kind: "list";
      value?: {
        id: string;
        name: string;
        description: string | null;
        gradingSystemId: GradingSystemId;
        periodMode: PeriodMode;
        locked: boolean;
        preferences: { showOnDashboard: boolean; includeInOverall: boolean };
      };
    }
  | {
      kind: "subject";
      gradeListId: string;
      showCourseType?: boolean;
      value?: { id: string; name: string; color: string | null; isAdvanced?: boolean };
    }
  | { kind: "type"; value?: { id: string; name: string; weight: number } };

export function EntityEditor(props: EditorProps) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const createTitles = { list: t.newList, subject: t.newSubject, type: t.newType };
  const title = props.value ? t.edit : createTitles[props.kind];
  return (
    <>
      <Button
        variant={props.value ? "secondary" : "default"}
        aria-label={props.value ? `${title}: ${props.value.name}` : title}
        onClick={() => setOpen(true)}
      >
        {title}
      </Button>
      {open && <EditorForm {...props} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function readEntityData(props: EditorProps, form: FormData, settings: ListSettings) {
  const name = form.get("name");
  switch (props.kind) {
    case "list":
      return {
        name,
        description: form.get("description"),
        ...settings,
        preferences: {
          showOnDashboard: form.has("showOnDashboard"),
          includeInOverall: form.has("includeInOverall"),
        },
      };
    case "subject":
      return {
        name,
        gradeListId: props.gradeListId,
        color: form.get("color") || null,
        ...(props.showCourseType ? { isAdvanced: form.has("isAdvanced") } : {}),
      };
    case "type":
      return { name, weight: form.get("weight") };
  }
}

function EditorForm(props: EditorProps & { title: string; onClose: () => void }) {
  const { t, locale } = useLanguage();
  const mutation = useGradeMutation();
  const [settings, setSettings] = useState<ListSettings>({
    gradingSystemId:
      props.kind === "list" ? (props.value?.gradingSystemId ?? "de_school_v1") : "de_school_v1",
    periodMode: props.kind === "list" ? (props.value?.periodMode ?? "NONE") : "NONE",
  });
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = readEntityData(props, form, settings);
    const command = gradeCommandSchema.safeParse({
      action: `${props.kind}.${props.value ? "update" : "create"}`,
      ...(props.value ? { id: props.value.id } : {}),
      data,
    });
    if (!command.success) {
      mutation.invalid();
      return;
    }
    if (await mutation.run(command.data)) {
      props.onClose();
    }
  }

  return (
    <Dialog
      title={props.kind === "list" && props.value ? t.editList : props.title}
      onClose={props.onClose}
      busy={mutation.pending}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <fieldset disabled={mutation.pending} className="space-y-4">
          <FormField label={t.name}>
            <Input
              name="name"
              required
              maxLength={120}
              defaultValue={props.value?.name}
              data-autofocus
            />
          </FormField>
          {props.kind === "list" && (
            <>
              <FormField label={t.listDescription}>
                <textarea
                  className={`${controlClass} resize-y`}
                  rows={2}
                  name="description"
                  maxLength={2000}
                  defaultValue={props.value?.description ?? ""}
                />
              </FormField>
              <ListSettingsFields
                value={settings}
                onChange={setSettings}
                canExtend={props.value?.gradingSystemId === "de_school_v1"}
                locked={props.value?.locked}
                creating={!props.value}
              />
              <fieldset className="space-y-2 pt-1">
                <legend className="mb-1 text-sm font-medium">{t.dashboardSettings}</legend>
                <div className="divide-y divide-border/50 rounded-xl bg-muted/35">
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-3 text-sm">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      className="size-4 shrink-0 text-muted-foreground"
                    >
                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    </svg>
                    <span className="flex-1">{t.showOnDashboard}</span>
                    <input
                      type="checkbox"
                      name="showOnDashboard"
                      defaultChecked={props.value ? props.value.preferences.showOnDashboard : true}
                      className="size-5 shrink-0 accent-primary"
                    />
                  </label>
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-3 text-sm">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      className="size-4 shrink-0 text-muted-foreground"
                    >
                      <circle cx="12" cy="12" r="8" />
                      <path d="m4 20 16-16" />
                    </svg>
                    <span className="flex-1">{t.includeInOverall}</span>
                    <input
                      type="checkbox"
                      name="includeInOverall"
                      defaultChecked={props.value ? props.value.preferences.includeInOverall : true}
                      className="size-5 shrink-0 accent-primary"
                    />
                  </label>
                </div>
              </fieldset>
            </>
          )}
          {props.kind === "subject" && (
            <>
              <SubjectColorPicker defaultValue={props.value?.color} />
              {props.showCourseType && (
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="isAdvanced"
                    defaultChecked={props.value?.isAdvanced}
                    className="size-4 accent-primary"
                  />
                  {t.advancedCourse}
                </label>
              )}
            </>
          )}
          {props.kind === "type" && (
            <>
              <FormField label={t.weight}>
                <Input
                  name="weight"
                  required
                  inputMode="decimal"
                  maxLength={12}
                  defaultValue={new Intl.NumberFormat(locale, { useGrouping: false }).format(
                    props.value?.weight ?? 1,
                  )}
                />
              </FormField>
              <p className="text-sm text-muted-foreground">{t.weightHelp}</p>
              <p className="text-sm text-muted-foreground">{t.typesHelp}</p>
            </>
          )}
        </fieldset>
        <MutationError message={mutation.error} />
        <div
          className={`flex flex-wrap justify-end gap-2 ${props.kind === "list" ? "border-t border-border/60 pt-4" : ""}`}
        >
          <Button variant="secondary" disabled={mutation.pending} onClick={props.onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" disabled={mutation.pending}>
            {mutation.pending ? t.saving : t.save}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
