"use client";

import { FilePicker, useAttachmentUpload } from "@/components/attachments/upload";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type SubmitEvent } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { localCalendarDate } from "@/lib/grades/dates";
import {
  gradingSystems,
  letterGrades,
  numericGradeChoices,
  formatGrade,
} from "@/lib/grades/systems";
import { gradeEntryInputSchema } from "@/lib/grades/validation";
import type { EntryView, ListChoice, TypeChoice } from "@/lib/grades/types";
import type { MessageKey } from "@/lib/i18n/messages";
import { controlClass, FormField, MutationError } from "./form-parts";
import { useGradeMutation } from "./use-grade-mutation";

const loadErrors: Partial<Record<number, MessageKey>> = {
  401: "gradeSignIn",
  403: "passwordRequired",
  404: "gradeNotFound",
};

type Props = {
  lists: ListChoice[];
  types: TypeChoice[];
  gradeListId?: string;
  subjectId?: string;
  entry?: EntryView;
  lookup?: { id: string; title: string };
  iconOnly?: boolean;
  buttonVariant?: "default" | "secondary";
  buttonClassName?: string;
};

export function EntryEditor(props: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<EntryView | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const { t } = useLanguage();
  const editing = props.entry ?? props.lookup;
  const title = editing ? t.edit : t.addEntry;
  const listName = props.gradeListId
    ? props.lists.find((list) => list.id === props.gradeListId)?.name
    : undefined;
  async function show() {
    if (!props.lookup) {
      setOpen(true);
      return;
    }
    if (request.current) {
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/entries/${encodeURIComponent(props.lookup.id)}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        setError(loadErrors[response.status] ?? "serviceUnavailable");
        return;
      }
      const result: { entry: EntryView & { gradeList: { status: "ACTIVE" | "ARCHIVED" } } } =
        await response.json();
      if (result.entry.gradeList.status === "ARCHIVED") {
        setError("archivedReadOnly");
        return;
      }
      setLoaded(result.entry);
      setOpen(true);
    } catch {
      if (!controller.signal.aborted) {
        setError("connectionFailed");
      }
    } finally {
      setLoading(false);
      request.current = null;
    }
  }
  return (
    <>
      <Button
        className={props.buttonClassName}
        variant={props.buttonVariant ?? (editing ? "secondary" : "default")}
        aria-label={
          editing ? `${title}: ${editing.title}` : listName ? `${title}: ${listName}` : title
        }
        title={title}
        aria-busy={loading}
        disabled={loading}
        onClick={show}
      >
        {editing && (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`size-4 shrink-0 ${loading ? "motion-safe:animate-pulse" : ""}`}
          >
            <path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5" />
          </svg>
        )}
        {!props.iconOnly && title}
      </Button>
      {loading && (
        <span role="status" className="sr-only">
          {t.loadingEntry}
        </span>
      )}
      {error && (
        <div className="max-w-64 text-left">
          <MutationError message={t[error]} />
        </div>
      )}
      {open && (
        <EntryForm
          {...props}
          entry={props.entry ?? loaded}
          title={editing ? t.editEntryTitle : t.newEntryTitle}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function EntryForm({
  lists,
  types,
  gradeListId,
  subjectId,
  entry,
  title,
  onClose,
}: Props & { title: string; onClose: () => void }) {
  const { t, locale } = useLanguage();
  const noteId = useId();
  const mutation = useGradeMutation();
  const upload = useAttachmentUpload();
  const [files, setFiles] = useState<File[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const submitting = useRef(false);
  const busy = mutation.pending || upload.pending;
  const [listId, setListId] = useState(
    entry?.gradeListId ??
      gradeListId ??
      lists.find((list) => list.isDefault)?.id ??
      lists[0]?.id ??
      "",
  );
  const [selectedSubject, setSubject] = useState(entry?.subjectId ?? subjectId ?? "");
  const [chosenTypeId, setTypeId] = useState(entry?.gradeTypeId ?? "");
  const [date, setDate] = useState(() => entry?.date ?? localCalendarDate());
  const list = lists.find((item) => item.id === listId);
  const availableTypes = types.filter(
    (type) =>
      list?.useAllGradeTypes ||
      list?.gradeTypes.some((selected) => selected.gradeTypeId === type.id) ||
      (entry?.gradeTypeId === type.id && entry.gradeListId === listId),
  );
  const typeId = availableTypes.some((type) => type.id === chosenTypeId)
    ? chosenTypeId
    : (availableTypes[0]?.id ?? "");
  const type = types.find((item) => item.id === typeId);
  const system = list ? gradingSystems[list.gradingSystemId] : null;
  const letters = list ? letterGrades(list.gradingSystemId) : null;
  const numericChoices = list ? numericGradeChoices(list.gradingSystemId) : null;
  const legacyGrade =
    entry?.grade != null && numericChoices && !numericChoices.includes(entry.grade)
      ? entry.grade
      : null;
  const format = new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 2 });
  const weight = entry && typeId === entry.gradeTypeId ? entry.weight : type?.weight;
  const ready = list && list.subjects.length > 0 && availableTypes.length > 0;
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) {
      return;
    }
    if (!list) {
      mutation.invalid();
      return;
    }
    if (!upload.validate(files, entry?.attachments.length ?? 0)) {
      return;
    }
    if (savedId) {
      submitting.current = true;
      try {
        if (await upload.upload(savedId, files, setFiles)) {
          onClose();
        }
      } finally {
        submitting.current = false;
      }
      return;
    }
    const form = new FormData(event.currentTarget);
    const parsed = gradeEntryInputSchema(list.gradingSystemId, entry?.grade).safeParse({
      gradeListId: listId,
      subjectId: selectedSubject,
      gradeTypeId: typeId,
      title: form.get("title"),
      date,
      grade: form.get("grade"),
      note: form.get("note"),
    });
    if (!parsed.success) {
      mutation.invalid();
      return;
    }
    const command = entry
      ? { action: "entry.update" as const, id: entry.id, data: parsed.data }
      : { action: "entry.create" as const, data: parsed.data };
    submitting.current = true;
    try {
      const id = await mutation.run(command);
      if (id) {
        setSavedId(id);
        if (files.length === 0 || (await upload.upload(id, files, setFiles))) {
          onClose();
        }
      }
    } finally {
      submitting.current = false;
    }
  }

  return (
    <Dialog title={title} onClose={onClose} busy={busy}>
      <form className="space-y-5" onSubmit={handleSubmit}>
        <fieldset disabled={busy || savedId !== null} className="min-w-0 space-y-4">
          <FormField label={t.gradeList}>
            <select
              className={`${controlClass} h-11 min-w-0`}
              required
              value={listId}
              disabled={!!entry}
              onChange={(event) => {
                setListId(event.target.value);
                setSubject("");
              }}
            >
              <option value="" disabled>
                {t.choose}
              </option>
              {lists.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          {!ready && (
            <p className="rounded-md bg-muted p-3 text-sm">
              {t.entryPrerequisites}{" "}
              <Link className="underline" href="/settings">
                {t.settings}
              </Link>
            </p>
          )}
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <FormField label={t.subject}>
              <select
                className={`${controlClass} h-11 min-w-0`}
                required
                value={selectedSubject}
                onChange={(event) => setSubject(event.target.value)}
              >
                <option value="" disabled>
                  {t.choose}
                </option>
                {list?.subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label={t.gradeType}>
              <select
                className={`${controlClass} h-11 min-w-0`}
                required
                value={typeId}
                onChange={(event) => setTypeId(event.target.value)}
              >
                <option value="" disabled>
                  {t.choose}
                </option>
                {availableTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <span className="text-xs font-normal text-muted-foreground">
                {t.weight}: {weight === undefined ? "—" : format.format(weight)}
              </span>
            </FormField>
          </div>
          <FormField label={t.entryTitle}>
            <Input
              name="title"
              data-autofocus={!entry || undefined}
              required
              maxLength={200}
              defaultValue={entry?.title ?? ""}
            />
          </FormField>
          <div className="space-y-3 rounded-2xl bg-muted/60 p-4">
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <FormField label={t.entryDate}>
                <Input
                  type="date"
                  required
                  value={date}
                  min="0001-01-01"
                  max="9999-12-31"
                  onChange={(event) => setDate(event.target.value)}
                />
              </FormField>
              <FormField label={t.grade}>
                {letters || numericChoices ? (
                  <select
                    key={listId}
                    name="grade"
                    className={controlClass}
                    defaultValue={
                      entry?.grade == null || !list
                        ? ""
                        : formatGrade(entry.grade, list.gradingSystemId, locale)
                    }
                    data-autofocus={entry ? "desktop" : undefined}
                  >
                    <option value="">{t.noGradeYet}</option>
                    {letters &&
                      [...letters].reverse().map((letter) => (
                        <option key={letter.label} value={letter.label}>
                          {letter.label} · {format.format(letter.points)} {t.pointsUnit}
                        </option>
                      ))}
                    {numericChoices?.map((value) => (
                      <option key={value} value={format.format(value)}>
                        {format.format(value)}
                      </option>
                    ))}
                    {legacyGrade !== null && (
                      <option value={format.format(legacyGrade)}>
                        {format.format(legacyGrade)} · {t.savedGrade}
                      </option>
                    )}
                  </select>
                ) : (
                  <Input
                    key={listId}
                    name="grade"
                    inputMode="decimal"
                    maxLength={16}
                    className="font-semibold"
                    defaultValue={
                      entry?.grade === undefined || entry.grade === null
                        ? ""
                        : format.format(entry.grade)
                    }
                    data-autofocus={entry ? "desktop" : undefined}
                  />
                )}
              </FormField>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <p>{t.gradeOptionalHint}</p>
              {letters ? (
                <p>{t.letterScaleHelp}</p>
              ) : (
                system && (
                  <p>
                    {t.gradeRange}: {format.format(system.min)}–{format.format(system.max)} ·{" "}
                    {system.entryStep === 1
                      ? t.wholeGradesOnly
                      : system.entryStep === 0.5
                        ? t.halfGradesOnly
                        : `${t.decimalPlaces}: ${system.decimalPlaces}`}
                  </p>
                )
              )}
            </div>
            {legacyGrade !== null && (
              <p className="text-xs text-muted-foreground">{t.legacyGradeHelp}</p>
            )}
          </div>
          <details open={entry?.note ? true : undefined} className="rounded-2xl bg-muted/45 px-4">
            <summary className="cursor-pointer py-3 text-sm font-medium">{t.note}</summary>
            <div className="pb-4">
              <label className="sr-only" htmlFor={noteId}>
                {t.note}
              </label>
              <textarea
                id={noteId}
                name="note"
                className={controlClass}
                rows={3}
                maxLength={20000}
                defaultValue={entry?.note ?? ""}
              />
            </div>
          </details>
        </fieldset>
        <details className="rounded-2xl bg-muted/45 px-4">
          <summary className="cursor-pointer py-3 text-sm font-medium">
            {t.attachmentsOptional}
            {files.length > 0 && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
                {format.format(files.length)}
              </span>
            )}
          </summary>
          <div className="pb-4">
            <FilePicker files={files} onChange={setFiles} disabled={busy} hideLabel />
          </div>
        </details>
        <div className="sticky -bottom-5 -mx-5 -mb-5 space-y-3 bg-card px-5 py-4 shadow-toolbar sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6">
          {savedId && (
            <p role="status" className="text-sm">
              {t.entrySavedUploads}
            </p>
          )}
          <MutationError message={mutation.error ?? upload.error} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={busy || !ready}>
              {busy ? t.saving : savedId ? t.uploadAttachments : t.save}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
