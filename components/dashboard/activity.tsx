"use client";

import { useState, type KeyboardEvent } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { useLocalDay } from "@/components/grades/use-local-day";
import {
  examPreviewLimit,
  partitionExams,
  type DashboardEntry,
  type RecentGradePage,
} from "@/lib/grades/dashboard";
import { RecentGrades } from "./recent-grades";
import { DashboardEntryList } from "./entry-list";
import type { ListChoice, TypeChoice } from "@/lib/grades/types";

type Tab = "upcoming" | "pending" | "recent";
const tabs: Tab[] = ["upcoming", "pending", "recent"];

export function DashboardActivity({
  exams,
  recent,
  lists,
  types,
}: {
  exams: DashboardEntry[];
  recent: RecentGradePage;
  lists: ListChoice[];
  types: TypeChoice[];
}) {
  const { t, locale } = useLanguage();
  const today = useLocalDay();
  const groups = today ? partitionExams(exams, today) : null;
  const [selection, setSelection] = useState<Tab | null>(null);
  let defaultTab: Tab = "upcoming";
  if ((!groups && exams.length) || groups?.upcoming.length) {
    defaultTab = "upcoming";
  } else if (groups?.pending.length) {
    defaultTab = "pending";
  } else if (recent.total) {
    defaultTab = "recent";
  }
  const active = selection ?? defaultTab;
  const sections = {
    upcoming: {
      id: "upcoming-exams",
      label: t.dashboardUpcomingTab,
      entries: groups?.upcoming ?? null,
      empty: t.noUpcomingExams,
    },
    pending: {
      id: "pending-grades",
      label: t.dashboardPendingTab,
      entries: groups?.pending ?? null,
      empty: t.noPendingGrades,
    },
    recent: {
      id: "recent-grades",
      label: t.recentGrades,
      entries: recent.entries,
      empty: t.noRecentGrades,
    },
  };

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    if (!(event.target instanceof HTMLButtonElement)) {
      return;
    }
    const index = buttons.indexOf(event.target);
    if (index < 0) {
      return;
    }

    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        next = (index + tabs.length - 1) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    setSelection(tabs[next]);
    buttons[next].focus();
  }

  return (
    <section className="panel space-y-4 py-5" aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="px-5 text-lg font-semibold tracking-tight">
        {t.dashboardActivityTitle}
      </h2>
      <div className="space-y-3 px-3 sm:px-5">
        <div
          role="tablist"
          aria-label={t.entries}
          className="grid grid-cols-3 gap-1 rounded-xl bg-muted/45 p-1"
          onKeyDown={handleTabKeyDown}
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              id={`dashboard-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={active === tab}
              aria-controls={sections[tab].id}
              tabIndex={active === tab ? 0 : -1}
              onClick={() => setSelection(tab)}
              className={`flex min-h-11 min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-lg px-1 py-2 text-xs font-medium transition-colors sm:text-sm ${active === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <span>{sections[tab].label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${active === tab ? "bg-primary/10 text-primary" : "bg-muted/60"}`}
              >
                {sections[tab].entries === null
                  ? "—"
                  : new Intl.NumberFormat(locale).format(
                      tab === "recent" ? recent.total : sections[tab].entries.length,
                    )}
              </span>
            </button>
          ))}
        </div>
        {tabs.map((tab) => (
          <div
            key={tab}
            id={sections[tab].id}
            role="tabpanel"
            aria-labelledby={`dashboard-tab-${tab}`}
            tabIndex={0}
            hidden={active !== tab}
          >
            {tab === "recent" ? (
              <RecentGrades initial={recent} lists={lists} types={types} />
            ) : (
              <ActivityEntries
                entries={sections[tab].entries}
                empty={sections[tab].empty}
                lists={lists}
                types={types}
              />
            )}
          </div>
        ))}
        <noscript>
          <p className="text-sm">{t.calendarNeedsJavascript}</p>
        </noscript>
      </div>
    </section>
  );
}

function ActivityEntries({
  entries,
  empty,
  lists,
  types,
}: {
  entries: DashboardEntry[] | null;
  empty: string;
  lists: ListChoice[];
  types: TypeChoice[];
}) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(examPreviewLimit);
  return (
    <div className="space-y-4">
      {entries === null ? (
        <p role="status" className="py-5 text-sm text-muted-foreground">
          {t.determiningLocalDay}
        </p>
      ) : entries.length === 0 ? (
        <div className="flex min-h-44 flex-col items-center justify-center gap-4 rounded-2xl bg-muted/30 px-6 py-8 text-center">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-8 text-muted-foreground/60"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="5" width="16" height="16" rx="3" />
            <path d="M8 3v4m8-4v4M4 11h16m-11 5 2 2 4-4" />
          </svg>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{empty}</p>
        </div>
      ) : (
        <DashboardEntryList entries={entries.slice(0, visible)} lists={lists} types={types} />
      )}
      {entries && entries.length > visible && (
        <Button
          className="w-full"
          variant="secondary"
          onClick={() => setVisible(visible + examPreviewLimit)}
        >
          {t.loadMore}
        </Button>
      )}
    </div>
  );
}
