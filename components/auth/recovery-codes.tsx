import { useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";

export function RecoveryCodes({
  codes,
  username,
  acknowledged,
  onAcknowledged,
  onDismiss,
}: {
  codes: string[];
  username: string;
  acknowledged: boolean;
  onAcknowledged: (value: boolean) => void;
  onDismiss?: () => void;
}) {
  const { t } = useLanguage();
  const text = useRef<HTMLTextAreaElement>(null);
  const [feedback, setFeedback] = useState<"copied" | "manual" | "downloaded" | null>(null);
  const value = codes.join("\n");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback("copied");
    } catch {
      text.current?.focus();
      text.current?.select();
      setFeedback("manual");
    }
  }
  function download() {
    const now = new Date();
    const body = [
      "GradeShelf — " + t.recoveryCodes,
      "=".repeat(36),
      `${t.username}: ${username}`,
      `${t.recoveryInstance}: ${window.location.origin}`,
      `${t.recoveryExported}: ${now.toISOString()}`,
      "",
      t.recoveryFileHelp,
      "",
      value,
      "",
      "GradeShelf",
      "",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `gradeshelf-recovery-codes-${username.replace(/[^a-zA-Z0-9_-]/g, "-")}-${now.toISOString().slice(0, 10)}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback("downloaded");
  }
  return (
    <section aria-label={t.recoveryCodes} className="space-y-4 rounded-2xl bg-muted/50 p-4">
      <div className="space-y-2">
        <h3 className="font-semibold">{t.saveCodes}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{t.codesHelp}</p>
      </div>
      <textarea
        ref={text}
        aria-label={t.recoveryCodes}
        readOnly
        value={value}
        rows={5}
        autoComplete="off"
        spellCheck={false}
        onFocus={(event) => event.currentTarget.select()}
        className="w-full resize-y rounded-xl border border-input bg-card px-4 py-3 font-mono text-base leading-7"
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={copy}>
          {t.copyAllCodes}
        </Button>
        <Button variant="secondary" onClick={download}>
          {t.downloadCodes}
        </Button>
      </div>
      {feedback && (
        <p role="status" className="text-xs leading-relaxed text-muted-foreground">
          {feedback === "copied"
            ? t.codesCopied
            : feedback === "manual"
              ? t.codesCopyManually
              : t.codesDownloadStarted}
        </p>
      )}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-card p-4 text-sm font-medium">
        <input
          type="checkbox"
          name="codes-saved"
          className="mt-0.5 size-5 shrink-0 accent-primary"
          checked={acknowledged}
          onChange={(event) => onAcknowledged(event.target.checked)}
        />
        {t.codesAcknowledged}
      </label>
      {onDismiss && (
        <Button variant="secondary" disabled={!acknowledged} onClick={onDismiss}>
          {t.hideCodes}
        </Button>
      )}
    </section>
  );
}
