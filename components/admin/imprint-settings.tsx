"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import Link from "next/link";
import { updateImprint } from "@/app/(protected)/admin/actions";
import type { ImprintSettings } from "@/lib/admin/imprint";
import type { MessageKey } from "@/lib/i18n/messages";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { controlClass, FormField, MutationError } from "@/components/grades/form-parts";

export function ImprintSettingsForm({ settings }: { settings: ImprintSettings }) {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(settings.imprintEnabled);
  const [text, setText] = useState(settings.imprintText);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await updateImprint({ imprintEnabled: enabled, imprintText: text });
        setError(result.error);
        setSaved(result.error === null);
      } catch {
        setError("connectionFailed");
      }
    });
  }

  return (
    <section className="space-y-4" aria-labelledby="imprint-settings-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="imprint-settings-heading" className="text-lg font-semibold">
          {t.imprint}
        </h2>
        {settings.imprintEnabled && (
          <Link href="/legal" className="text-sm text-primary underline underline-offset-4">
            {t.imprintView}
          </Link>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t.imprintHelp}</p>
      <form
        onSubmit={handleSubmit}
        onChange={() => setSaved(false)}
        aria-busy={pending}
        className="space-y-4"
      >
        <fieldset disabled={pending} className="space-y-4">
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="size-4"
            />
            {t.imprintEnable}
          </label>
          <FormField label={t.imprintText}>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              required={enabled}
              maxLength={20000}
              rows={6}
              className={`${controlClass} min-h-36 resize-y font-normal`}
            />
          </FormField>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">{pending ? t.saving : t.save}</Button>
            {saved && (
              <p role="status" className="text-sm text-muted-foreground">
                {t.imprintSaved}
              </p>
            )}
          </div>
        </fieldset>
        <MutationError message={error ? t[error] : null} />
      </form>
    </section>
  );
}
