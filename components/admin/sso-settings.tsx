"use client";

import { useRef, useState, useTransition, type SubmitEvent } from "react";
import { checkSsoConfiguration, updateSsoSettings } from "@/app/(protected)/admin/actions";
import type { SsoSettingsView } from "@/lib/auth/sso-validation";
import type { MessageKey } from "@/lib/i18n/messages";
import { useLanguage } from "@/components/i18n/provider";
import { Field, FormMessage } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";

export function SsoSettings({ initial }: { initial: SsoSettingsView }) {
  const { t } = useLanguage();
  const [settings, setSettings] = useState(initial);
  const [secret, setSecret] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);
  const [message, setMessage] = useState<MessageKey | null>(null);
  const callbackInput = useRef<HTMLInputElement>(null);

  function clearFeedback() {
    setError(null);
    setMessage(null);
  }

  function execute(check: boolean) {
    clearFeedback();
    startTransition(async () => {
      try {
        const input = {
          enabled: settings.enabled,
          issuer: settings.issuer,
          clientId: settings.clientId,
          clientSecret: secret || undefined,
          revision: settings.revision,
        };
        if (check) {
          const result = await checkSsoConfiguration(input);
          setError(result.error);
          if (!result.error) {
            setMessage("ssoCheckPassed");
          }
        } else {
          const result = await updateSsoSettings(input);
          setError(result.error);
          if (!result.error && result.settings) {
            setSettings(result.settings);
            setSecret("");
            setMessage("ssoSaved");
          }
        }
      } catch {
        setError("connectionFailed");
      }
    });
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) {
      execute(false);
    }
  }

  async function copyCallback() {
    clearFeedback();
    try {
      await navigator.clipboard.writeText(settings.callbackUrl);
      setMessage("ssoCopied");
    } catch {
      callbackInput.current?.select();
      setError("ssoCopyFailed");
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="sso-admin-heading">
      <div className="space-y-2">
        <h2 id="sso-admin-heading" className="text-lg font-semibold">
          {t.ssoTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{t.ssoAdminHelp}</p>
      </div>
      <form method="post" onSubmit={submit} aria-busy={pending} className="space-y-4">
        <fieldset disabled={pending} className="space-y-4">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              id="sso-enabled"
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => {
                clearFeedback();
                setSettings({ ...settings, enabled: event.target.checked });
              }}
              className="size-4 accent-primary"
            />
            {t.ssoEnable}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="sso-issuer"
              label={t.ssoIssuer}
              type="url"
              required
              maxLength={2048}
              placeholder="https://auth.example.com"
              value={settings.issuer}
              autoComplete="off"
              onChange={(event) => {
                clearFeedback();
                setSettings({ ...settings, issuer: event.target.value });
              }}
            />
            <Field
              id="sso-client-id"
              label={t.ssoClientId}
              required
              maxLength={256}
              value={settings.clientId}
              autoComplete="off"
              onChange={(event) => {
                clearFeedback();
                setSettings({ ...settings, clientId: event.target.value });
              }}
            />
          </div>
          <Field
            id="sso-client-secret"
            label={t.ssoClientSecret}
            type="password"
            maxLength={4096}
            value={secret}
            autoComplete="new-password"
            required={!settings.hasClientSecret}
            hint={settings.hasClientSecret ? t.ssoSecretStored : t.ssoSecretHelp}
            onChange={(event) => {
              clearFeedback();
              setSecret(event.target.value);
            }}
          />
          <div className="space-y-2">
            <label htmlFor="sso-callback" className="block text-sm font-medium">
              {t.ssoCallback}
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                ref={callbackInput}
                id="sso-callback"
                readOnly
                value={settings.callbackUrl}
                className="grade-input min-w-0 flex-1"
              />
              <Button variant="secondary" onClick={copyCallback}>
                {t.ssoCopy}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{t.ssoChangesHelp}</p>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">{pending ? t.saving : t.save}</Button>
            <Button variant="secondary" onClick={() => execute(true)}>
              {t.ssoCheck}
            </Button>
          </div>
        </fieldset>
        <FormMessage
          error={error ? t[error] : undefined}
          message={message ? t[message] : undefined}
        />
      </form>
    </section>
  );
}
