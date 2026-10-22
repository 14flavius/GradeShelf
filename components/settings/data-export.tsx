"use client";

import { settingsSections } from "@/lib/settings-sections";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { MutationError } from "@/components/grades/form-parts";
import { Button } from "@/components/ui/button";
import type { MessageKey } from "@/lib/i18n/messages";
import { resolveTheme, themeStorageKey } from "@/lib/theme";

const exportErrors: Record<string, MessageKey> = {
  UNAUTHENTICATED: "gradeSignIn",
  PASSWORD_CHANGE_REQUIRED: "passwordRequired",
  FORBIDDEN: "gradeForbidden",
  EXPORT_BUSY: "exportBusy",
};

export function DataExport() {
  const { t } = useLanguage();
  const request = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function download() {
    if (request.current) {
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setDownloaded(false);
    setError(null);
    let receivingArchive = false;
    try {
      let theme = resolveTheme(null);
      try {
        theme = resolveTheme(localStorage.getItem(themeStorageKey));
      } catch {
        /* Restricted browser storage uses the system appearance. */
      }
      const response = await fetch("/api/account/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        const code = result && typeof result === "object" && "code" in result ? result.code : null;
        setError(
          typeof code === "string" && Object.hasOwn(exportErrors, code)
            ? exportErrors[code]
            : "exportUnavailable",
        );
        return;
      }
      if (response.headers.get("content-type") !== "application/zip") {
        setError("exportUnavailable");
        return;
      }
      receivingArchive = true;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download =
          response.headers
            .get("content-disposition")
            ?.match(/filename="(gradeshelf-export-[0-9TZ.-]+\.zip)"/)?.[1] ??
          "gradeshelf-export.zip";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setDownloaded(true);
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      if (!controller.signal.aborted) {
        setError(receivingArchive ? "exportFailed" : "connectionFailed");
      }
    } finally {
      request.current = null;
      setPending(false);
    }
  }

  return (
    <section
      id={settingsSections.dataExport}
      className="space-y-5 rounded-2xl bg-card p-5 shadow-surface sm:p-6"
      aria-labelledby="export-heading"
      aria-busy={pending}
    >
      <div>
        <h2 id="export-heading" className="text-xl font-semibold">
          {t.dataExport}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.dataExportHelp}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col items-start gap-4 rounded-xl bg-muted/40 p-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
              >
                <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" />
                <path d="M14 3v5h5M8 13h8M8 17h5" />
              </svg>
            </span>
            <h3 className="font-semibold">{t.pdfExport}</h3>
          </div>
          <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{t.exportPdfHelp}</p>
          <Link
            href="/export/pdf"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent sm:w-auto"
          >
            {t.openPdfReport}
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
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </Link>
        </div>
        <div className="flex min-w-0 flex-col items-start gap-4 rounded-xl bg-muted/40 p-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
              >
                <path d="M4 8h16v12H4zM3 4h18v4H3zM10 12h4" />
              </svg>
            </span>
            <h3 className="font-semibold">{t.exportArchiveTitle}</h3>
          </div>
          <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
            {t.exportArchiveHelp}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={download}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
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
              <path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" />
            </svg>
            {pending ? t.exportPreparing : t.downloadExport}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t.exportPrivacy}</p>
      <MutationError message={error ? t[error] : null} />
      <p role="status" className="text-sm text-muted-foreground empty:hidden">
        {pending ? t.exportWait : downloaded ? t.exportDownloaded : null}
      </p>
    </section>
  );
}
