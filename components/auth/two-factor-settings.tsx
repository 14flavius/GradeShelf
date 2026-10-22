"use client";

import { useLanguage } from "@/components/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth/client";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, authErrorMessage } from "./form-parts";
import { RecoveryCodes } from "./recovery-codes";

function SetupCode({ uri }: { uri: string }) {
  const { t } = useLanguage();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<MessageKey | "">("");
  useEffect(() => {
    let cancelled = false;
    if (canvas.current) {
      QRCode.toCanvas(canvas.current, uri, { width: 240, margin: 2 }).catch(() => {
        if (!cancelled) {
          setError("qrFailed");
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [uri]);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t.scanQr}</p>
      <canvas ref={canvas} role="img" aria-label={t.qrLabel} className="max-w-full rounded-lg" />
      <details className="text-sm">
        <summary className="cursor-pointer">{t.manualKey}</summary>
        <code className="mt-2 block break-all rounded bg-muted p-3 select-all">
          {new URL(uri).searchParams.get("secret")}
        </code>
      </details>
      <FormMessage error={error ? t[error] : ""} />
    </div>
  );
}

export function TwoFactorSettings({
  enabled: initiallyEnabled,
  username,
}: {
  enabled: boolean;
  username: string;
}) {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [uri, setUri] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [codesSaved, setCodesSaved] = useState(false);
  const [codeVersion, setCodeVersion] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | "">("");
  const [message, setMessage] = useState<MessageKey | "">("");

  async function manage(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitter = event.nativeEvent.submitter;
    const action = submitter instanceof HTMLButtonElement ? submitter.value : "enable";
    const password = String(new FormData(form).get("password"));
    setError("");
    setMessage("");
    setPending(true);
    try {
      if (action === "enable") {
        const result = await authClient.twoFactor.enable({ password, method: "totp" });
        if (result.error) {
          setError(authErrorMessage(result.error, "setupFailed"));
        } else if (result.data?.method === "totp") {
          const url = new URL(result.data.totpURI);
          url.pathname = `/${encodeURIComponent("GradeShelf:" + username)}`;
          setUri(url.toString());
          setCodes(result.data.backupCodes);
          setCodesSaved(false);
          setCodeVersion((version) => version + 1);
          form.reset();
        }
      } else if (action === "regenerate") {
        const result = await authClient.twoFactor.generateBackupCodes({ password });
        if (result.error) {
          setError(authErrorMessage(result.error, "regenerateFailed"));
        } else if (result.data) {
          setCodes(result.data.backupCodes);
          setCodesSaved(false);
          setCodeVersion((version) => version + 1);
          setMessage("codesRegenerated");
          form.reset();
        }
      } else if (action === "disable") {
        const result = await authClient.twoFactor.disable({ password });
        if (result.error) {
          setError(authErrorMessage(result.error, "disableFailed"));
        } else {
          setEnabled(false);
          setUri("");
          setCodes([]);
          setMessage("disabled");
          form.reset();
        }
      }
    } catch {
      setError("connectionFailed");
    } finally {
      setPending(false);
    }
  }

  async function verify(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !codesSaved) {
      return;
    }
    setError("");
    setPending(true);
    const code = String(new FormData(event.currentTarget).get("code"));
    try {
      const result = await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
      if (result.error) {
        setError(authErrorMessage(result.error, "totpFailed"));
      } else {
        setEnabled(true);
        setUri("");
        setCodes([]);
        setCodesSaved(false);
        setMessage("enabled");
      }
    } catch {
      setError("connectionFailed");
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingsPanel
      id="two-factor-settings"
      title={t.twoFactor}
      status={enabled ? t.isEnabled : t.isDisabled}
    >
      <div className="space-y-5" aria-busy={pending}>
        <p className="text-sm leading-6 text-muted-foreground">{t.twoFactorHelp}</p>
        {uri ? (
          <div className="space-y-5">
            <SetupCode uri={uri} />
            <RecoveryCodes
              key={codeVersion}
              codes={codes}
              username={username}
              acknowledged={codesSaved}
              onAcknowledged={setCodesSaved}
            />
            <form onSubmit={verify} className="space-y-4">
              <Field
                id="setup-code"
                name="code"
                label={t.confirmSixDigits}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                required
                maxLength={6}
              />
              <Button type="submit" disabled={pending || !codesSaved}>
                {t.enable2fa}
              </Button>
            </form>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setUri("");
                setCodes([]);
                setError("");
              }}
            >
              {t.closeSetup}
            </Button>
            <p className="text-xs text-muted-foreground">{t.setupHelp}</p>
          </div>
        ) : (
          <form onSubmit={manage} className="space-y-4">
            <Field
              id="two-factor-password"
              name="password"
              label={t.currentPassword}
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
            {enabled ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{t.replaceCodesHelp}</p>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" value="regenerate" disabled={pending}>
                    {t.newCodes}
                  </Button>
                  <Button type="submit" value="disable" variant="secondary" disabled={pending}>
                    {t.disable2fa}
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="submit" value="enable" disabled={pending}>
                {t.setupApp}
              </Button>
            )}
          </form>
        )}
        <FormMessage error={error ? t[error] : ""} message={message ? t[message] : ""} />
        {!uri && codes.length > 0 && (
          <RecoveryCodes
            key={codeVersion}
            codes={codes}
            username={username}
            acknowledged={codesSaved}
            onAcknowledged={setCodesSaved}
            onDismiss={() => setCodes([])}
          />
        )}
      </div>
    </SettingsPanel>
  );
}
