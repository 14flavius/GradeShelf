"use client";

import { useLanguage } from "@/components/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const { t } = useLanguage();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | "">("");
  async function handleSignOut() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("signOutFailed");
      } else {
        router.replace("/login");
        router.refresh();
      }
    } catch {
      setError("signOutFailed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" disabled={pending} onClick={handleSignOut}>
        {pending ? t.signingOut : t.signOut}
      </Button>
      {error && (
        <p role="alert" className="max-w-xs text-xs text-destructive">
          {t[error]}
        </p>
      )}
    </div>
  );
}
