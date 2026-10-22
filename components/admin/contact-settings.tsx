"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import { updateAdminContact } from "@/app/(protected)/admin/actions";
import { adminContactMaxLength } from "@/lib/admin/contact-validation";
import type { MessageKey } from "@/lib/i18n/messages";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { controlClass, FormField, MutationError } from "@/components/grades/form-parts";

export function ContactSettings({ contact }: { contact: string }) {
  const { t, locale } = useLanguage();
  const [text, setText] = useState(contact);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);
  const [saved, setSaved] = useState(false);
  const number = new Intl.NumberFormat(locale);
  const counter = t.adminContactCounter
    .replace("{count}", number.format(text.length))
    .replace("{limit}", number.format(adminContactMaxLength));

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await updateAdminContact({ adminContact: text });
        setError(result.error);
        setSaved(result.error === null);
      } catch {
        setError("connectionFailed");
      }
    });
  }

  return (
    <section className="space-y-4" aria-labelledby="admin-contact-heading">
      <div className="space-y-2">
        <h2 id="admin-contact-heading" className="text-lg font-semibold">
          {t.adminContactTitle}
        </h2>
        <p id="admin-contact-help" className="text-sm leading-relaxed text-muted-foreground">
          {t.adminContactHelp}
        </p>
      </div>
      <form onSubmit={handleSubmit} aria-busy={pending} className="space-y-4">
        <fieldset disabled={pending} className="space-y-3">
          <FormField label={t.adminContactText}>
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setSaved(false);
              }}
              maxLength={adminContactMaxLength}
              rows={4}
              aria-describedby="admin-contact-help admin-contact-count"
              className={`${controlClass} resize-y font-normal`}
            />
          </FormField>
          <p
            id="admin-contact-count"
            className="text-right text-xs tabular-nums text-muted-foreground"
          >
            {counter}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">{pending ? t.saving : t.save}</Button>
            {saved && (
              <p role="status" className="text-sm text-muted-foreground">
                {t.adminContactSaved}
              </p>
            )}
          </div>
        </fieldset>
        <MutationError message={error ? t[error] : null} />
      </form>
    </section>
  );
}
