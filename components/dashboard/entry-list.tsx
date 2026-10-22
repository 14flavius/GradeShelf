"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/provider";
import { formatCalendarDate } from "@/lib/grades/dates";
import type { DashboardEntry } from "@/lib/grades/dashboard";
import { gradingSystems, formatGrade, letterGrades } from "@/lib/grades/systems";
import type { ListChoice, TypeChoice } from "@/lib/grades/types";
import { EntryEditor } from "@/components/grades/entry-editor";
import { EntryLink } from "@/components/grades/entry-link";
import { OpenIcon } from "@/components/ui/open-icon";
import { NotePreview } from "./note-preview";

export function DashboardEntryList({
  entries,
  lists,
  types,
}: {
  entries: DashboardEntry[];
  lists: ListChoice[];
  types: TypeChoice[];
}) {
  const { t, locale } = useLanguage();
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const units = { PERCENT: "%", POINTS: t.pointsUnit, GRADE: t.gradeUnit };
  return (
    <ul className="divide-y divide-border/50">
      {entries.map((entry) => {
        const system = gradingSystems[entry.gradeList.gradingSystemId];
        const unit = letterGrades(entry.gradeList.gradingSystemId)
          ? t.gradeUnit
          : units[system.unit];
        return (
          <li
            key={entry.id}
            className="interactive-row group relative grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-2 py-3 transition-colors hover:bg-muted/35 sm:grid-cols-[3rem_minmax(0,1fr)_auto]"
          >
            <div
              className={`row-span-2 flex min-h-14 flex-col items-center justify-center self-start rounded-xl px-1 py-2 sm:row-span-1 sm:self-center ${entry.grade !== null ? "bg-primary/8 text-primary" : "bg-muted/60"}`}
              title={t[system.labelKey]}
            >
              {entry.grade !== null ? (
                <>
                  <span className="text-xl font-semibold tabular-nums">
                    {formatGrade(entry.grade, entry.gradeList.gradingSystemId, locale)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{unit}</span>
                </>
              ) : (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="size-6 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  <rect x="4" y="5" width="16" height="16" rx="3" />
                  <path d="M8 3v4m8-4v4M4 11h16" />
                </svg>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <h3 className="break-words text-sm font-semibold group-hover:text-primary [overflow-wrap:anywhere]">
                {entry.title}
              </h3>
              <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {entry.subject.name} · {entry.gradeList.name}
              </p>
              <p className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                <time dateTime={entry.date}>{formatCalendarDate(entry.date, locale)}</time>
                <span className="break-words [overflow-wrap:anywhere]">{entry.gradeType.name}</span>
              </p>
              <span className="sr-only">
                {t.weight}: {format.format(entry.weight)} · {t[system.labelKey]}
              </span>
            </div>
            <div className="col-start-2 -ml-2 flex gap-0.5 sm:col-start-3 sm:row-start-1 sm:ml-0">
              {entry.notePreview && (
                <NotePreview text={entry.notePreview} entryTitle={entry.title} />
              )}
              <EntryEditor
                lists={lists}
                types={types}
                lookup={{ id: entry.id, title: entry.title }}
                iconOnly
                buttonClassName="surface-action size-10 shrink-0 rounded-xl bg-transparent px-0 text-muted-foreground"
              />
              <EntryLink id={entry.id} title={entry.title} />
              <Link
                href={`/lists/${entry.gradeListId}/subjects/${entry.subjectId}#entry-${entry.id}`}
                aria-label={`${t.openSubject}: ${entry.subject.name}`}
                title={t.openSubject}
                className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <OpenIcon />
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
