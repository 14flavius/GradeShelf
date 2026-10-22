"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function EntryLink({
  id,
  title,
  compact = true,
}: {
  id: string;
  title: string;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  return (
    <>
      <Button
        variant="secondary"
        className={`relative z-10 shrink-0 ${compact ? "size-10 rounded-xl bg-transparent px-0 text-muted-foreground" : ""}`}
        title={t.copyEntryLink}
        aria-label={`${t.copyEntryLink}: ${title}`}
        onClick={async () => {
          const url = new URL(`/entries/${encodeURIComponent(id)}`, window.location.origin).href;
          try {
            await navigator.clipboard.writeText(url);
            if (resetTimer.current !== null) {
              clearTimeout(resetTimer.current);
            }
            setCopied(true);
            resetTimer.current = setTimeout(() => {
              setCopied(false);
              resetTimer.current = null;
            }, 1500);
          } catch {
            setCopied(false);
            setManualUrl(url);
          }
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          {copied ? (
            <path d="m5 12 4 4L19 6" />
          ) : (
            <>
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
            </>
          )}
        </svg>
        {!compact && t.copyEntryLink}
      </Button>
      <span role="status" className="sr-only">
        {copied ? t.entryLinkCopied : null}
      </span>
      {manualUrl && (
        <Dialog title={t.copyEntryLink} onClose={() => setManualUrl(null)}>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t.entryLinkManual}</p>
            <Input
              aria-label={t.copyEntryLink}
              value={manualUrl}
              readOnly
              data-autofocus
              onFocus={(event) => event.currentTarget.select()}
            />
            <p className="text-xs text-muted-foreground">{t.entryLinkPrivate}</p>
          </div>
        </Dialog>
      )}
    </>
  );
}
