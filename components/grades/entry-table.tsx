"use client";

import { AttachmentsPanel } from "@/components/attachments/panel";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { entryStatus, formatCalendarDate } from "@/lib/grades/dates";
import type { EntryView, ListChoice, TypeChoice } from "@/lib/grades/types";
import { useLocalDay } from "./use-local-day";
import { DeleteButton } from "./delete-button";
import { EntryEditor } from "./entry-editor";
import { formatGrade } from "@/lib/grades/systems";
import { EntryLink } from "./entry-link";
import Link from "next/link";
import { OpenIcon } from "@/components/ui/open-icon";

type StatusFilter = "ALL" | "UPCOMING" | "PENDING_GRADE" | "GRADED";
const filters: StatusFilter[] = ["ALL", "UPCOMING", "PENDING_GRADE", "GRADED"];

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const readHash = () => window.location.hash;
const serverHash = () => "";

export function EntryTable({
  entries,
  lists,
  types,
  readOnly = false,
  showSubject = true,
  focused = false,
}: {
  entries: EntryView[];
  lists: ListChoice[];
  types: TypeChoice[];
  readOnly?: boolean;
  showSubject?: boolean;
  focused?: boolean;
}) {
  const { t, locale } = useLanguage();
  const [visible, setVisible] = useState(5);
  const hash = useSyncExternalStore(subscribeToHash, readHash, serverHash);
  useEffect(() => {
    if (hash.startsWith("#entry-")) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: "center" });
    }
  }, [hash]);
  const [ascending, setAscending] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  // A calendar date has no server timezone. Defer relative labels until the browser's day is known.
  const today = useLocalDay();
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const labels = {
    ALL: t.allEntries,
    UPCOMING: t.upcoming,
    PENDING_GRADE: t.pendingGrade,
    GRADED: t.graded,
  };
  const classified = entries.map<{ entry: EntryView; status: Exclude<StatusFilter, "ALL"> | null }>(
    (entry) => ({
      entry,
      status:
        entry.grade !== null
          ? "GRADED"
          : today
            ? entryStatus(entry.date, entry.grade, today)
            : null,
    }),
  );
  const sorted = classified
    .filter(({ status }) => filter === "ALL" || status === filter)
    .sort(
      (a, b) =>
        (ascending ? 1 : -1) * a.entry.date.localeCompare(b.entry.date) ||
        (ascending ? 1 : -1) *
          (new Date(a.entry.gradedAt ?? 0).getTime() - new Date(b.entry.gradedAt ?? 0).getTime()) ||
        a.entry.id.localeCompare(b.entry.id),
    );
  // Existing subject links must reveal their target even beyond the first page.
  const shown = Math.max(
    visible,
    sorted.findIndex(({ entry }) => hash === `#entry-${entry.id}`) + 1,
  );
  return (
    <section className="space-y-4" aria-label={t.entries}>
      {!focused && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            {t.entries}
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {format.format(entries.length)}
            </span>
          </h2>
          {entries.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                setAscending(!ascending);
                setVisible(5);
              }}
            >
              {ascending ? t.oldestFirst : t.newestFirst}
            </Button>
          )}
        </div>
      )}
      {!focused && entries.length > 0 && (
        <div
          role="group"
          aria-label={t.filterEntries}
          className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted/50 p-1"
        >
          {filters.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              disabled={!today && (value === "UPCOMING" || value === "PENDING_GRADE")}
              onClick={() => {
                setFilter(value);
                setVisible(5);
              }}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm transition-colors disabled:opacity-50 ${filter === value ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"}`}
            >
              {labels[value]}
              <span className="text-xs tabular-nums">
                {!today && (value === "UPCOMING" || value === "PENDING_GRADE")
                  ? "—"
                  : format.format(
                      value === "ALL"
                        ? entries.length
                        : classified.filter(({ status }) => status === value).length,
                    )}
              </span>
            </button>
          ))}
        </div>
      )}
      {sorted.length === 0 ? (
        <p
          role="status"
          className="rounded-2xl bg-muted/50 p-6 text-center text-sm text-muted-foreground"
        >
          {entries.length === 0 ? t.emptyEntries : t.noMatchingEntries}
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-card shadow-surface">
          {(focused ? sorted : sorted.slice(0, shown)).map(({ entry, status }) => (
            <li
              key={entry.id}
              id={`entry-${entry.id}`}
              className="group relative grid min-w-0 scroll-mt-6 grid-cols-[minmax(0,1fr)_auto] transition-colors hover:bg-accent/20 target:bg-primary/5"
            >
              <div className="col-span-2 grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-4 px-4 pb-1 pt-4 sm:col-span-1 sm:px-5">
                <div
                  className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-1.5 py-2 ${entry.grade === null ? "bg-muted/60" : "bg-primary/5"}`}
                >
                  <span className="text-xl font-semibold tabular-nums">
                    {entry.grade === null
                      ? "—"
                      : formatGrade(entry.grade, entry.gradeList.gradingSystemId, locale)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{t.gradeValue}</span>
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="break-words font-semibold group-hover:text-primary [overflow-wrap:anywhere]">
                      {entry.title}
                    </h3>
                    {status && status !== "GRADED" && (
                      <span
                        className={`text-xs font-medium ${status === "UPCOMING" ? "text-primary" : "text-[light-dark(#92400e,#fbbf24)]"}`}
                      >
                        {labels[status]}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <time dateTime={entry.date}>{formatCalendarDate(entry.date, locale)}</time>
                    <span aria-hidden="true">·</span>
                    <span className="break-words [overflow-wrap:anywhere]">
                      {showSubject && (
                        <>
                          {entry.subject.name}
                          <span aria-hidden="true"> · </span>
                        </>
                      )}
                      {entry.gradeType.name}
                      <span aria-hidden="true"> · </span>
                      {t.weight}: {format.format(entry.weight)}
                    </span>
                    {status === "GRADED" && <span className="sr-only">{labels[status]}</span>}
                  </div>
                </div>
              </div>
              <div className="col-start-2 row-start-2 flex items-center justify-end gap-0.5 self-start pr-4 sm:row-start-1 sm:self-center sm:pr-5 sm:pt-3">
                {readOnly ? (
                  <Button
                    variant="secondary"
                    className="surface-action"
                    aria-label={`${t.entryDetails}: ${entry.title}`}
                    aria-controls={`entry-details-${entry.id}`}
                    onClick={() => {
                      const details = document.getElementById(`entry-details-${entry.id}`);
                      if (details instanceof HTMLDetailsElement) {
                        details.open = true;
                        details.querySelector("summary")?.focus();
                      }
                    }}
                  >
                    {t.entryDetails}
                  </Button>
                ) : (
                  <EntryEditor
                    lists={lists}
                    types={types}
                    entry={entry}
                    iconOnly={!focused}
                    buttonClassName={
                      focused
                        ? "surface-action"
                        : "surface-action size-10 rounded-xl bg-transparent px-0 text-muted-foreground"
                    }
                  />
                )}
                {!focused && <EntryLink id={entry.id} title={entry.title} />}
                {!focused && (
                  <Link
                    href={`/entries/${entry.id}`}
                    aria-label={`${t.openEntry}: ${entry.title}`}
                    title={t.openEntry}
                    className="relative z-10 flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <OpenIcon />
                  </Link>
                )}
              </div>
              <details
                id={`entry-details-${entry.id}`}
                open={focused ? true : undefined}
                className="group/details col-span-2 col-start-1 row-start-2 min-w-0 pb-2 open:bg-muted/20"
              >
                <summary className="relative z-10 ml-4 flex min-h-11 w-fit cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-sm py-2 pr-3 text-xs text-muted-foreground hover:text-foreground max-sm:max-w-[calc(100%_-_11rem)] sm:ml-[5.25rem] sm:min-h-9 [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1">
                    {t.entryDetails}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="size-3.5 group-open/details:rotate-180"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                  <span className="sr-only">: {entry.title}</span>
                  {entry.note && <span>{t.noteAvailable}</span>}
                  {entry.attachments.length > 0 && (
                    <span>
                      {t.attachments}: {format.format(entry.attachments.length)}
                    </span>
                  )}
                </summary>
                <div className="relative z-10 px-4 pb-4 sm:px-5">
                  {entry.note && (
                    <div className="rounded-lg bg-muted/50 p-4">
                      <h4 className="mb-2 text-sm font-medium">{t.entryNote}</h4>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
                        {entry.note}
                      </p>
                    </div>
                  )}
                  <AttachmentsPanel
                    entryId={entry.id}
                    attachments={entry.attachments}
                    readOnly={readOnly}
                  />
                  {!readOnly && (
                    <div className="mt-4 pt-4">
                      <DeleteButton
                        kind="entry"
                        id={entry.id}
                        name={entry.title}
                        returnTo={
                          focused
                            ? `/lists/${entry.gradeListId}/subjects/${entry.subjectId}`
                            : undefined
                        }
                      />
                    </div>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      {!focused && sorted.length > 5 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-xs tabular-nums text-muted-foreground">
            {t.entriesShown
              .replace("{shown}", format.format(Math.min(shown, sorted.length)))
              .replace("{total}", format.format(sorted.length))}
          </p>
          {sorted.length > shown && (
            <Button variant="secondary" onClick={() => setVisible(shown + 5)}>
              {t.loadMore}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
