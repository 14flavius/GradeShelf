"use client";

import { entryReturnPath, withReturnPath } from "@/lib/auth/return-path";
import { useLanguage } from "@/components/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, authErrorMessage } from "./form-parts";
import { AdminContact } from "./admin-contact";

export function LoginForm({
  returnTo = "/dashboard",
  adminContact,
}: {
  returnTo?: string;
  adminContact: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [error, setError] = useState<MessageKey | "">("");
  const [pending, setPending] = useState(false);
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.username({
        username: String(data.get("username")).trim().toLowerCase(),
        password: String(data.get("password")),
      });
      if (result.error) {
        setError(authErrorMessage(result.error, "signInFailed"));
      } else {
        router.replace(
          result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect
            ? withReturnPath("/verify-two-factor", returnTo)
            : entryReturnPath(returnTo),
        );
        router.refresh();
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
        id="username"
        name="username"
        label={t.username}
        className="h-12 rounded-lg"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        minLength={3}
        maxLength={32}
        autoFocus
      />
      <Field
        id="password"
        name="password"
        label={t.password}
        className="h-12 rounded-lg"
        type="password"
        autoComplete="current-password"
        required
        maxLength={128}
      />
      <FormMessage error={error ? t[error] : ""} />
      <Button type="submit" className="min-h-12 w-full rounded-lg" disabled={pending}>
        {pending ? t.signingIn : t.signIn}
      </Button>
      <AdminContact contact={adminContact} />
    </form>
  );
}
