"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import { updateInstanceName } from "@/app/(protected)/admin/actions";
import { instanceNameMaxLength } from "@/lib/admin/instance-validation";
import type { MessageKey } from "@/lib/i18n/messages";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, MutationError } from "@/components/grades/form-parts";

export function InstanceSettings({ name }: { name: string }) {
  const { t } = useLanguage();
  const [text, setText] = useState(name);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);
  const [saved, setSaved] = useState(false);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await updateInstanceName({ instanceName: text });
        setError(result.error);
        setSaved(result.error === null);
      } catch {
        setError("connectionFailed");
      }
    });
  }

  return (
    <section className="space-y-4" aria-labelledby="instance-heading">
      <div className="space-y-2">
        <h2 id="instance-heading" className="text-lg font-semibold">
          {t.instanceName}
        </h2>
        <p id="instance-help" className="text-sm leading-relaxed text-muted-foreground">
          {t.instanceNameHelp}
        </p>
      </div>
      <form onSubmit={submit} aria-busy={pending} className="space-y-4">
        <fieldset disabled={pending} className="space-y-4">
          <FormField label={t.instanceName}>
            <Input
              name="instanceName"
              value={text}
              placeholder="GradeShelf"
              maxLength={instanceNameMaxLength}
              aria-describedby="instance-help"
              onChange={(event) => {
                setText(event.target.value);
                setSaved(false);
              }}
            />
          </FormField>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">{pending ? t.saving : t.save}</Button>
            {saved && (
              <p role="status" className="text-sm text-muted-foreground">
                {t.instanceNameSaved}
              </p>
            )}
          </div>
        </fieldset>
        <MutationError message={error ? t[error] : null} />
      </form>
    </section>
  );
}
