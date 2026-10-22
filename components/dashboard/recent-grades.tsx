"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { MutationError } from "@/components/grades/form-parts";
import type { MessageKey } from "@/lib/i18n/messages";
import type { RecentGradePage } from "@/lib/grades/dashboard";
import type { ListChoice, TypeChoice } from "@/lib/grades/types";
import { DashboardEntryList } from "./entry-list";

export function RecentGrades({
  initial,
  lists,
  types,
}: {
  initial: RecentGradePage;
  lists: ListChoice[];
  types: TypeChoice[];
}) {
  const { t, locale } = useLanguage();
  const [state, setState] = useState({
    source: initial,
    page: initial,
    pending: false,
    error: null as MessageKey | null,
  });
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  // A server refresh after editing must also discard previously loaded pages.
  if (state.source !== initial) {
    setState({ source: initial, page: initial, pending: false, error: null });
  }
  const { page, pending, error } = state;
  const format = new Intl.NumberFormat(locale);
  async function loadMore() {
    if (pending || !page.nextCursor) {
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState((current) => ({ ...current, pending: true, error: null }));
    try {
      const response = await fetch(
        `/api/dashboard/recent?cursor=${encodeURIComponent(JSON.stringify(page.nextCursor))}`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok) {
        const error: MessageKey =
          response.status === 401
            ? "gradeSignIn"
            : response.status === 403
              ? "passwordRequired"
              : "serviceUnavailable";
        setState((current) =>
          current.source === initial ? { ...current, pending: false, error } : current,
        );
        return;
      }
      const next: RecentGradePage = await response.json();
      setState((current) =>
        current.source !== initial
          ? current
          : {
              ...current,
              pending: false,
              page: {
                ...next,
                entries: [
                  ...current.page.entries,
                  ...next.entries.filter(
                    (entry) => !current.page.entries.some((item) => item.id === entry.id),
                  ),
                ],
              },
            },
      );
    } catch {
      if (!controller.signal.aborted) {
        setState((current) =>
          current.source === initial
            ? { ...current, pending: false, error: "connectionFailed" }
            : current,
        );
      }
    }
  }
  return (
    <div className="space-y-4">
      {page.entries.length ? (
        <DashboardEntryList entries={page.entries} lists={lists} types={types} />
      ) : (
        <p className="rounded-xl bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {t.noRecentGrades}
        </p>
      )}
      <MutationError message={error ? t[error] : null} />
      {page.total > initial.entries.length && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-xs tabular-nums text-muted-foreground">
            {t.entriesShown
              .replace("{shown}", format.format(page.entries.length))
              .replace("{total}", format.format(page.total))}
          </p>
          {page.nextCursor && (
            <Button variant="secondary" disabled={pending} onClick={loadMore}>
              {pending ? t.loadingMore : t.loadMore}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
