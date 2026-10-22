"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/provider";
import { authClient } from "@/lib/auth/client";
import { displayNameSchema } from "@/lib/auth/validation";
import type { MessageKey } from "@/lib/i18n/messages";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, authErrorMessage } from "./form-parts";

export function DisplayNameForm({ name, username }: { name: string; username: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<MessageKey | "">("");
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError("");
    setSaved(false);
    const parsed = displayNameSchema.safeParse(value);
    if (!parsed.success) {
      setError("displayNameInvalid");
      return;
    }
    setPending(true);
    try {
      const result = await authClient.updateUser({ name: parsed.data });
      if (result.error) {
        setError(authErrorMessage(result.error, "displayNameFailed"));
      } else {
        setValue(parsed.data || username);
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("connectionFailed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-3" aria-busy={pending} onSubmit={handleSubmit}>
      <Field
        id="display-name"
        label={t.displayName}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setSaved(false);
          setError("");
        }}
        autoComplete="nickname"
        maxLength={80}
        placeholder={username}
        disabled={pending}
        hint={t.displayNameHelp}
      />
      <FormMessage error={error ? t[error] : ""} message={saved ? t.displayNameSaved : ""} />
      <Button type="submit" disabled={pending}>
        {pending ? t.saving : t.save}
      </Button>
    </form>
  );
}
