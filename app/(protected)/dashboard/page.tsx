import { settingsSections } from "@/lib/settings-sections";
import type { Metadata } from "next";
import Link from "next/link";
import { OpenIcon } from "@/components/ui/open-icon";
import { getDashboardTrends, gradeTrend } from "@/lib/grades/trends";
import { TrendSummary } from "@/components/grades/trend-summary";
import { getRequestMessages } from "@/lib/i18n/server";
import { requireUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { getDashboardData } from "@/lib/grades/dashboard-queries";
import { getEntryChoices } from "@/lib/grades/queries";
import { AverageDisplay } from "@/components/grades/average-display";
import { SetupTutorial } from "@/components/onboarding/setup-tutorial";
import { InstallApp } from "@/components/install-app";
import { gradingSystems } from "@/lib/grades/systems";
import { EntryEditor } from "@/components/grades/entry-editor";
import { DashboardActivity } from "@/components/dashboard/activity";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRequestMessages()).dashboard };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const db = await getDb();
  const [t, data, choices, trends] = await Promise.all([
    getRequestMessages(),
    getDashboardData(db, user.id),
    getEntryChoices(user.id),
    getDashboardTrends(db, user.id),
  ]);
  const format = new Intl.NumberFormat(user.locale);
  const hasActiveLists = choices.lists.length > 0;
  const overallProgress = data.overall.filter(({ average }) => average.gradedCount >= 2);
  const subjectProgress = trends.subjects.filter(({ trend }) => trend.points.length >= 2);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1.5 text-sm text-muted-foreground">{t.overview}</p>
          <h1 className="break-words text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
            {t.welcomeUser}, {user.name || user.username}.
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <InstallApp />
          {hasActiveLists && <EntryEditor {...choices} />}
        </div>
      </div>
      {!hasActiveLists ? (
        <section className="panel space-y-6 p-6 sm:p-8">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight">{t.dashboardStartTitle}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t.dashboardStartHelp}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <SetupTutorial
              autoStart={!data.hasLists}
              userId={user.id}
              availableTypes={choices.types}
            />
            <Link
              href="/lists"
              className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-primary"
            >
              {t.manageGrades}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              [t.dashboardStepList, t.dashboardStepListHelp],
              [t.dashboardStepSubjects, t.dashboardStepSubjectsHelp],
              [t.dashboardStepEntry, t.dashboardStepEntryHelp],
            ].map(([title, help], index) => (
              <li key={title} className="space-y-3 rounded-2xl bg-muted/50 p-5">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {index + 1}
                </span>
                <h3 className="font-medium">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{help}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <>
          <section className="panel space-y-2 px-5 py-4" aria-label={t.overallAverages}>
            <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <h2 className="text-sm font-semibold">{t.overallAverage}</h2>
              <Link
                href={{ pathname: "/settings", hash: settingsSections.dashboard }}
                className="inline-flex min-h-10 items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                {t.configureOverall}
                <OpenIcon />
              </Link>
            </header>
            {data.overall.length === 0 ? (
              <p className="pb-2 text-sm text-muted-foreground">{t.noOverallLists}</p>
            ) : (
              <div
                className={`grid gap-x-8 gap-y-3 ${data.overall.length > 1 ? "sm:grid-cols-2" : ""} ${data.overall.length > 2 ? "xl:grid-cols-3" : ""}`}
              >
                {data.overall.map(({ systemId, average }) => (
                  <div
                    key={systemId}
                    className="flex min-w-0 flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-border/60 py-3"
                  >
                    <div className="min-w-0 flex-1 basis-36 space-y-1">
                      <p className="text-xs font-medium leading-relaxed">
                        {t[gradingSystems[systemId].labelKey]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {average.gradedCount
                          ? `${t.gradedEntries}: ${format.format(average.gradedCount)}`
                          : t.noGradedEntries}
                      </p>
                    </div>
                    <div
                      className={`shrink-0 [&_output]:text-3xl [&_output]:tracking-tight ${average.value === null ? "text-muted-foreground" : "text-primary"}`}
                    >
                      <AverageDisplay
                        average={average}
                        systemId={systemId}
                        locale={user.locale}
                        label="overallAverage"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <DashboardActivity exams={data.exams} recent={data.recent} {...choices} />
            <section className="panel space-y-2 py-4" aria-label={t.visibleLists}>
              <header className="flex flex-wrap items-center justify-between gap-2 px-5">
                <h2 className="text-lg font-semibold tracking-tight">{t.visibleLists}</h2>
                <Link
                  href="/lists"
                  className="inline-flex min-h-10 items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                >
                  {t.lists}
                  <OpenIcon />
                </Link>
              </header>
              <div className="px-3 sm:px-5">
                {data.lists.length === 0 ? (
                  <div className="space-y-3 rounded-lg bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">{t.selectVisibleLists}</p>
                    <Link
                      href={{ pathname: "/settings", hash: settingsSections.dashboard }}
                      className="inline-flex min-h-10 items-center text-sm text-primary underline underline-offset-4"
                    >
                      {t.dashboardSettings}
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {data.lists.map((list) => (
                      <li
                        key={list.id}
                        className="relative space-y-3 px-2 py-4 transition-colors hover:bg-muted/35"
                      >
                        <Link
                          href={`/lists/${list.id}`}
                          className="surface-action group block min-w-0"
                        >
                          <h3 className="flex items-start justify-between gap-3 text-sm font-semibold group-hover:text-primary">
                            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                              {list.name}
                            </span>
                            <OpenIcon />
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {t[gradingSystems[list.gradingSystemId].labelKey]}
                          </p>
                        </Link>
                        <div className="flex flex-wrap items-center justify-between gap-3 [&_output]:text-xl">
                          <AverageDisplay
                            average={list.average}
                            systemId={list.gradingSystemId}
                            locale={user.locale}
                          />
                          <div className="relative z-10">
                            <EntryEditor
                              {...choices}
                              gradeListId={list.id}
                              buttonVariant="secondary"
                            />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
          {overallProgress.length > 0 && (
            <section aria-labelledby="overall-progress" className="space-y-4 pt-2">
              <div>
                <h2 id="overall-progress" className="text-xl font-semibold">
                  {t.overallProgress}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t.overallProgressHelp}
                </p>
              </div>
              <div className={`grid gap-4 ${overallProgress.length > 1 ? "lg:grid-cols-2" : ""}`}>
                {overallProgress.map(({ systemId }) => (
                  <section key={systemId} className="panel space-y-4 p-5">
                    <h3 className="text-sm font-medium">{t[gradingSystems[systemId].labelKey]}</h3>
                    <TrendSummary
                      trend={trends.overall.get(systemId) ?? gradeTrend(systemId, [])}
                      systemId={systemId}
                      locale={user.locale}
                      wide={overallProgress.length === 1}
                    />
                  </section>
                ))}
              </div>
            </section>
          )}
          {subjectProgress.length > 0 && (
            <section aria-labelledby="subject-trends" className="space-y-4 pt-2">
              <div>
                <h2 id="subject-trends" className="text-xl font-semibold">
                  {t.subjectTrends}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">{t.subjectTrendsHelp}</p>
              </div>
              <ul
                className={`grid gap-4 ${subjectProgress.length > 1 ? "md:grid-cols-2" : ""} ${subjectProgress.length > 2 ? "xl:grid-cols-3" : ""}`}
              >
                {subjectProgress.map((subject) => (
                  <li key={subject.id} className="min-w-0">
                    <div className="relative h-full space-y-4 rounded-2xl bg-card p-5 shadow-surface">
                      <Link
                        href={`/lists/${subject.listId}/subjects/${subject.id}`}
                        className="surface-action group block min-w-0"
                      >
                        <h3 className="flex items-center justify-between gap-3 break-words font-semibold group-hover:text-primary">
                          {subject.name} <OpenIcon />
                        </h3>
                        <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                          {subject.listName} · {t[gradingSystems[subject.systemId].labelKey]}
                        </p>
                      </Link>
                      <TrendSummary
                        trend={subject.trend}
                        systemId={subject.systemId}
                        locale={user.locale}
                        wide={subjectProgress.length === 1}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
