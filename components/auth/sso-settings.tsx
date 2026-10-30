"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { ssoProviderId, ssoReauthPath } from "@/lib/auth/sso-validation";
import type { MessageKey } from "@/lib/i18n/messages";
import { useLanguage } from "@/components/i18n/provider";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { Button } from "@/components/ui/button";
import { authErrorMessage, FormMessage } from "./form-parts";

export function SsoAccountSettings({
  enabled,
  accountId,
  canManage,
  initialError,
}: {
  enabled: boolean;
  accountId: string | null;
  canManage: boolean;
  initialError?: MessageKey;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | undefined>(initialError);
  const [removed, setRemoved] = useState(false);

  async function updateLink() {
    setPending(true);
    setError(undefined);
    setRemoved(false);
    try {
      const result = accountId
        ? await authClient.unlinkAccount({ accountId })
        : await authClient.linkSocial({ provider: ssoProviderId });
      if (result.error) {
        setError(authErrorMessage(result.error, "ssoFailed"));
      } else if (accountId) {
        setRemoved(true);
        router.refresh();
      }
    } catch {
      setError("connectionFailed");
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingsPanel
      id="sso-settings"
      title={t.ssoTitle}
      status={accountId ? t.ssoConnected : t.ssoDisconnected}
      open={Boolean(error)}
    >
      <div className="space-y-4" aria-busy={pending}>
        <p className="text-sm text-muted-foreground">{t.ssoAccountHelp}</p>
        {!enabled && <p className="text-sm text-muted-foreground">{t.ssoDisabled}</p>}
        <p className="text-sm text-muted-foreground">{t.ssoMfaHelp}</p>
        {!canManage || error === "ssoReauthRequired" ? (
          <div className="space-y-3">
            <p className="text-sm">{t.ssoReauthRequired}</p>
            <Link href={ssoReauthPath} className="grade-button" data-variant="secondary">
              {t.ssoReauthenticate}
            </Link>
          </div>
        ) : (
          <Button
            onClick={updateLink}
            disabled={pending || (!enabled && !accountId)}
            variant="secondary"
          >
            {pending ? t.ssoWorking : accountId ? t.ssoDisconnect : t.ssoConnect}
          </Button>
        )}
        <FormMessage
          error={error ? t[error] : undefined}
          message={removed ? t.ssoRemoved : undefined}
        />
      </div>
    </SettingsPanel>
  );
}
