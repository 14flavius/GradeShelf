"use client";

import { entryReturnPath } from "@/lib/auth/return-path";
import { useLanguage } from "@/components/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { passwordSchema } from "@/lib/auth/validation";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, authErrorMessage } from "./form-parts";
import { PasswordMatchHint } from "./password-match-hint";

export function PasswordForm({
  required = false,
  returnTo = "/dashboard",
}: {
  required?: boolean;
  returnTo?: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [error, setError] = useState<MessageKey | "">("");
  const [message, setMessage] = useState<MessageKey | "">("");
  const [pending, setPending] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const matches = confirmation.length > 0 && confirmation === newValue;
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword"));
    const newPassword = String(data.get("newPassword"));
    setError("");
    setMessage("");
    if (!passwordSchema.safeParse(newPassword).success) {
      setError("passwordLength");
      return;
    }
    if (newPassword === currentPassword) {
      setError("passwordDifferent");
      return;
    }
    if (newPassword !== data.get("confirmation")) {
      setError("passwordMismatch");
      return;
    }
    setPending(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setError(authErrorMessage(result.error, "passwordFailed"));
      } else if (required) {
        router.replace(entryReturnPath(returnTo));
        router.refresh();
      } else {
        form.reset();
        setNewValue("");
        setConfirmation("");
        setMessage("passwordChanged");
      }
    } catch {
      setError("connectionFailed");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
      <Field
        id="current-password"
        name="currentPassword"
        label={required ? t.temporaryPassword : t.currentPassword}
        type="password"
        autoComplete="current-password"
        required
        maxLength={128}
        autoFocus={required}
      />
      <Field
        id="new-password"
        name="newPassword"
        label={t.newPassword}
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        hint={t.passwordHint}
        value={newValue}
        onChange={(event) => {
          setNewValue(event.target.value);
          setError("");
        }}
      />
      <div className="space-y-2">
        <Field
          id="confirm-password"
          name="confirmation"
          label={t.confirmPassword}
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={confirmation}
          onChange={(event) => {
            setConfirmation(event.target.value);
            setError("");
          }}
          aria-describedby="password-match"
          aria-invalid={confirmation.length > 0 && !matches}
        />
        <PasswordMatchHint id="password-match" password={newValue} confirmation={confirmation} />
      </div>
      <FormMessage error={error ? t[error] : ""} message={message ? t[message] : ""} />
      <Button type="submit" disabled={pending}>
        {pending ? t.saving : t.changePassword}
      </Button>
    </form>
  );
}
