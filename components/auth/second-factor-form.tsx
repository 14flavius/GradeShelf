"use client";

import { entryReturnPath, withReturnPath } from "@/lib/auth/return-path";
import { useLanguage } from "@/components/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type SubmitEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, authErrorMessage } from "./form-parts";

export function SecondFactorForm({ returnTo = "/dashboard" }: { returnTo?: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<MessageKey | "">("");
  const [pending, setPending] = useState(false);
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const code = String(new FormData(event.currentTarget).get("code")).trim();
    try {
      const result = recovery
        ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: false })
        : await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
      if (result.error) {
        setError(authErrorMessage(result.error, "codeFailed"));
      } else {
        router.replace(entryReturnPath(returnTo));
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
        key={String(recovery)}
        id="code"
        name="code"
        label={recovery ? t.recoveryCode : t.appCode}
        autoFocus
        inputMode={recovery ? "text" : "numeric"}
        autoComplete={recovery ? "off" : "one-time-code"}
        required
        pattern={recovery ? undefined : "[0-9]{6}"}
        maxLength={recovery ? 64 : 6}
        spellCheck={false}
      />
      <FormMessage error={error ? t[error] : ""} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t.checking : t.confirm}
      </Button>
      <Button
        variant="secondary"
        className="w-full"
        disabled={pending}
        onClick={() => {
          setRecovery(!recovery);
          setError("");
        }}
      >
        {recovery ? t.useAppCode : t.useRecoveryCode}
      </Button>
      <Link
        href={withReturnPath("/login", returnTo)}
        className="block text-center text-sm text-muted-foreground underline underline-offset-4"
      >
        {t.backToSignIn}
      </Link>
    </form>
  );
}
