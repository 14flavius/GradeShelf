"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, MutationError, controlClass } from "@/components/grades/form-parts";
import { SettingsPanel } from "./settings-panel";
import { settingsSections } from "@/lib/settings-sections";
import {
  calendarResultSchema,
  calendarSettingsSchema,
  calendarVariables,
  type CalendarCommand,
  type CalendarFeedView,
  type CalendarSettings,
} from "@/lib/calendar/validation";

type Preview = { title: string; description: string } | null;

export function CalendarFeedSettings({
  initial,
  lists,
}: {
  initial: CalendarFeedView;
  lists: { id: string; name: string; status: string }[];
}) {
  const { t } = useLanguage();
  const [feed, setFeed] = useState(initial);
  const [draft, setDraft] = useState<CalendarSettings>(() =>
    calendarSettingsSchema.strip().parse(initial),
  );
  const [url, setURL] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<Preview | undefined>();
  const [confirm, setConfirm] = useState<"rotate" | "disable" | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleInput = useRef<HTMLInputElement>(null);
  const descriptionInput = useRef<HTMLTextAreaElement>(null);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(calendarSettingsSchema.strip().parse(feed));

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  function update<K extends keyof CalendarSettings>(key: K, value: CalendarSettings[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setPreview(undefined);
    setSaved(false);
    setConfirm(null);
  }

  function insert(field: "titleTemplate" | "descriptionTemplate", variable: string) {
    if (!calendarVariables.some((item) => item === variable)) {
      return;
    }
    const element = field === "titleTemplate" ? titleInput.current : descriptionInput.current;
    const value = draft[field];
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? start;
    const insertion = `{${variable}}`;
    const next = value.slice(0, start) + insertion + value.slice(end);
    if (next.length > (field === "titleTemplate" ? 200 : 4000)) {
      return;
    }
    update(field, next);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + insertion.length, start + insertion.length);
    });
  }

  async function send(command: CalendarCommand) {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/account/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      if (!response.ok) {
        setError(
          response.status === 409
            ? t.calendarConflict
            : response.status === 400
              ? t.calendarInvalid
              : t.calendarError,
        );
        return;
      }
      const result = calendarResultSchema.parse(await response.json());
      if ("preview" in result) {
        setPreview(result.preview);
      } else {
        setFeed(result.feed);
        // Revoking access must remain possible even with unsaved template edits.
        if (command.action !== "disable") {
          setDraft(calendarSettingsSchema.strip().parse(result.feed));
        }
        if (result.url || command.action === "disable") {
          setURL(result.url);
        }
        setSaved(true);
        setConfirm(null);
        setCopied(false);
      }
    } catch {
      setError(t.calendarError);
    } finally {
      setPending(false);
    }
  }

  function saveOrPreview(action: "save" | "preview") {
    const parsed = calendarSettingsSchema.safeParse(draft);
    if (!parsed.success) {
      setError(t.calendarInvalid);
      return;
    }
    void send(
      action === "save"
        ? { action, settings: parsed.data, revision: feed.revision }
        : { action, settings: parsed.data },
    );
  }

  async function copyURL() {
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(t.calendarCopyError);
    }
  }

  const variablePicker = (field: "titleTemplate" | "descriptionTemplate") => (
    <select
      aria-label={`${t.calendarVariables}: ${field === "titleTemplate" ? t.calendarEventTitle : t.calendarDescription}`}
      className={`${controlClass} max-w-56`}
      value=""
      disabled={pending}
      onChange={(event) => insert(field, event.target.value)}
    >
      <option value="">{t.calendarVariables}</option>
      {calendarVariables.map((variable) => (
        <option key={variable} value={variable}>{`{${variable}}`}</option>
      ))}
    </select>
  );

  return (
    <SettingsPanel
      id={settingsSections.calendar}
      title={t.calendarTitle}
      status={feed.enabled ? t.calendarOn : t.calendarOff}
    >
      <div className="space-y-6">
        <p className="text-sm leading-relaxed text-muted-foreground">{t.calendarIntro}</p>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            saveOrPreview("save");
          }}
        >
          <fieldset disabled={pending} className="space-y-5 disabled:opacity-70">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t.calendarName}>
                <Input
                  required
                  maxLength={80}
                  value={draft.name}
                  onChange={(event) => update("name", event.target.value)}
                />
              </FormField>
              <FormField label={t.calendarLanguage}>
                <select
                  className={controlClass}
                  value={draft.locale}
                  onChange={(event) => update("locale", event.target.value === "de" ? "de" : "en")}
                >
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </select>
              </FormField>
            </div>
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium">{t.calendarLists}</legend>
              <p className="text-sm text-muted-foreground">{t.calendarListsHelp}</p>
              {lists.length === 0 && <p className="text-sm">{t.calendarNoLists}</p>}
              <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                {lists.map((list) => (
                  <label
                    key={list.id}
                    className="flex min-w-0 cursor-pointer items-center gap-3 rounded-xl bg-muted/40 p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      checked={draft.listIds.includes(list.id)}
                      onChange={(event) =>
                        update(
                          "listIds",
                          event.target.checked
                            ? [...draft.listIds, list.id].sort()
                            : draft.listIds.filter((id) => id !== list.id),
                        )
                      }
                    />
                    <span className="break-words">
                      {list.name}
                      {list.status === "ARCHIVED" && (
                        <span className="ml-2 text-xs text-muted-foreground">{t.archived}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2">
              <FormField label={t.calendarEventTitle}>
                <Input
                  ref={titleInput}
                  required
                  maxLength={200}
                  value={draft.titleTemplate}
                  onChange={(event) => update("titleTemplate", event.target.value)}
                />
              </FormField>
              {variablePicker("titleTemplate")}
            </div>
            <div className="space-y-2">
              <FormField label={t.calendarDescription}>
                <textarea
                  ref={descriptionInput}
                  rows={4}
                  maxLength={4000}
                  className={controlClass}
                  value={draft.descriptionTemplate}
                  onChange={(event) => update("descriptionTemplate", event.target.value)}
                />
              </FormField>
              {variablePicker("descriptionTemplate")}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t.calendarVariablesHelp}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!dirty && feed.revision > 0}>
                {pending ? t.saving : t.save}
              </Button>
              <Button variant="secondary" onClick={() => saveOrPreview("preview")}>
                {t.calendarPreview}
              </Button>
            </div>
          </fieldset>
        </form>
        {preview !== undefined && (
          <div className="space-y-2 rounded-xl bg-muted/40 p-4" aria-live="polite">
            {preview ? (
              <>
                <p className="break-words font-medium">{preview.title}</p>
                <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {preview.description}
                </p>
              </>
            ) : (
              <p className="text-sm">{t.calendarNoPreview}</p>
            )}
            <p className="text-xs text-muted-foreground">{t.calendarPreviewLimits}</p>
          </div>
        )}
        <div className="space-y-3 border-t border-border pt-5">
          <div className="flex flex-wrap gap-2">
            {feed.enabled ? (
              <>
                <Button
                  variant="secondary"
                  disabled={pending || dirty}
                  onClick={() => setConfirm("rotate")}
                >
                  {t.calendarRotate}
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setConfirm("disable")}
                >
                  {t.calendarDisable}
                </Button>
              </>
            ) : (
              <Button
                disabled={pending || dirty || feed.revision === 0 || draft.listIds.length === 0}
                onClick={() => void send({ action: "enable", revision: feed.revision })}
              >
                {t.calendarEnable}
              </Button>
            )}
          </div>
          {(dirty || feed.revision === 0) && (
            <p className="text-sm text-muted-foreground">{t.calendarSaveFirst}</p>
          )}
          {confirm && (
            <div
              className="space-y-3 rounded-xl bg-muted/40 p-4"
              role="group"
              aria-label={confirm === "rotate" ? t.calendarRotate : t.calendarDisable}
            >
              <p className="text-sm">
                {confirm === "rotate" ? t.calendarRotateConfirm : t.calendarDisableConfirm}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pending}
                  onClick={() => void send({ action: confirm, revision: feed.revision })}
                >
                  {t.calendarConfirm}
                </Button>
                <Button variant="secondary" disabled={pending} onClick={() => setConfirm(null)}>
                  {t.cancel}
                </Button>
              </div>
            </div>
          )}
          {url && (
            <div className="space-y-3 rounded-xl bg-primary/5 p-4">
              <p className="text-sm leading-relaxed">{t.calendarSecret}</p>
              <FormField label={t.calendarURL}>
                <Input
                  readOnly
                  value={url}
                  spellCheck={false}
                  autoComplete="off"
                  onFocus={(event) => event.currentTarget.select()}
                />
              </FormField>
              <Button variant="secondary" onClick={() => void copyURL()}>
                {copied ? t.calendarCopied : t.calendarCopy}
              </Button>
            </div>
          )}
          <p className="text-sm leading-relaxed text-muted-foreground">{t.calendarSubscribeHelp}</p>
        </div>
        <MutationError message={error} />
        {saved && (
          <p role="status" className="text-sm text-muted-foreground">
            {t.calendarSaved}
          </p>
        )}
      </div>
    </SettingsPanel>
  );
}
