import { periodLabel } from "@/lib/grades/periods";
import { calculationSubjectSelect } from "@/lib/grades/calculation-data";
import { PeriodSelector, selectedPeriod } from "@/components/grades/period-selector";
import type { Metadata } from "next";
import { gradeTrend } from "@/lib/grades/trends";
import { TrendSummary } from "@/components/grades/trend-summary";
import { ListTypeSelector } from "@/components/grades/list-type-selector";
import { AverageDisplay } from "@/components/grades/average-display";
import { ArchiveButton } from "@/components/grades/archive-button";
import {
  calculateList,
  calculateSubject,
  weightedAverage,
  finalGradeAverage,
} from "@/lib/grades/averages";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { getRequestMessages } from "@/lib/i18n/server";
import { getEntries, getEntryChoices } from "@/lib/grades/queries";
import { gradingSystems } from "@/lib/grades/systems";
import { EntityEditor } from "@/components/grades/entity-editor";
import { DeleteButton } from "@/components/grades/delete-button";
import { EntryEditor } from "@/components/grades/entry-editor";
import { EntryTable } from "@/components/grades/entry-table";
import { PageActions } from "@/components/grades/page-actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRequestMessages()).gradeList };
}

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ listId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireUser();
  const { listId } = await params;
  const db = await getDb();
  const list = await db.gradeList.findFirst({
    where: { id: listId, userId: user.id },
    include: {
      dashboardPreference: true,
      subjects: {
        where: { userId: user.id },
        orderBy: { name: "asc" },
        select: calculationSubjectSelect(user.id),
      },
    },
  });
  if (!list) {
    notFound();
  }
  const [t, choices, entries] = await Promise.all([
    getRequestMessages(),
    getEntryChoices(user.id),
    getEntries(user.id, list.id),
  ]);
  const position = selectedPeriod((await searchParams).period, list.periodMode);
  const visibleSubjects = list.subjects.filter(
    (subject) =>
      position === 0 ||
      subject.periods.some((period) => period.period.position === position && period.enrolled),
  );
  const selectedEntries =
    position === 0
      ? entries
      : entries.filter((entry) => entry.subjectPeriod?.period.position === position);
  const average = calculateList({ ...list, entries }, position);
  const bySubject = new Map(
    list.subjects.map((subject) => [
      subject.id,
      calculateSubject(list, subject, entries, position),
    ]),
  );
  const emptyAverage = weightedAverage(list.gradingSystemId, []);
  const editableList = choices.lists.find((item) => item.id === list.id);
  const readOnly = list.status === "ARCHIVED";
  const format = new Intl.NumberFormat(user.locale);
  return (
    <div className="space-y-6">
      <Link
        href="/lists"
        className="inline-flex min-h-10 items-center gap-2 rounded-sm text-sm text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden="true">←</span>
        {t.lists}
      </Link>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="break-words text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
                  {list.name}
                </h1>
                <span
                  className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${readOnly ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}
                >
                  {readOnly ? t.archived : t.active}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t[gradingSystems[list.gradingSystemId].labelKey]}
              </p>
            </div>
            {readOnly && <p className="text-sm text-muted-foreground">{t.archivedReadOnly}</p>}
            {list.description && (
              <details className="text-sm text-muted-foreground">
                <summary className="w-fit cursor-pointer py-1 hover:text-foreground">
                  {t.listDescriptionDetails}
                </summary>
                <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed [overflow-wrap:anywhere]">
                  {list.description}
                </p>
              </details>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!readOnly && (
              <EntryEditor {...choices} gradeListId={list.id} periodPosition={position} />
            )}
            <PageActions label={t.listActions}>
              {!readOnly && (
                <>
                  <EntityEditor
                    kind="list"
                    value={{
                      id: list.id,
                      name: list.name,
                      description: list.description,
                      gradingSystemId: list.gradingSystemId,
                      periodMode: list.periodMode,
                      locked: !!list.gradingSystemLockedAt,
                      preferences: {
                        showOnDashboard: list.dashboardPreference?.showOnDashboard === true,
                        includeInOverall: list.dashboardPreference?.includeInOverall === true,
                      },
                    }}
                  />
                  <DeleteButton kind="list" id={list.id} name={list.name} returnTo="/lists" />
                </>
              )}
              {!readOnly && editableList && (
                <ListTypeSelector list={editableList} types={choices.types} />
              )}
              <ArchiveButton id={list.id} name={list.name} archived={readOnly} />
            </PageActions>
          </div>
        </div>
      </header>
      <PeriodSelector
        mode={list.periodMode}
        position={position}
        href={`/lists/${list.id}`}
        locale={user.locale}
      />
      <section
        className="panel grid items-center gap-5 p-6 sm:grid-cols-[11rem_minmax(0,1fr)] lg:grid-cols-[12rem_minmax(0,1fr)]"
        aria-label={t.overallAverage}
      >
        <div className="space-y-3 [&_output]:text-4xl lg:[&_output]:text-5xl">
          <p className="text-sm font-medium text-muted-foreground">{t.overallAverage}</p>
          <AverageDisplay
            average={average}
            systemId={list.gradingSystemId}
            locale={user.locale}
            label="overallAverage"
          />
          <p className="text-xs text-muted-foreground">
            {average.gradedCount
              ? `${average.basis === "PERIODS" ? t.finalGradeCount : t.gradedEntries}: ${format.format(average.gradedCount)}`
              : t.noGradedEntries}
          </p>
        </div>
        <div className="min-w-0 border-t border-border/60 pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          {list.periodMode === "SEMESTERS" && position === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t.finalGradeHelp}</p>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((index) => (
                  <Link
                    key={index}
                    className="rounded-xl bg-muted/50 p-3 hover:bg-accent"
                    href={`/lists/${list.id}?period=${index}`}
                  >
                    <p className="mb-2 text-sm font-medium">{periodLabel(index, t)}</p>
                    <AverageDisplay
                      average={finalGradeAverage(
                        list.gradingSystemId,
                        list.subjects
                          .flatMap((subject) => subject.periods)
                          .filter((period) => period.period.position === index),
                      )}
                      systemId={list.gradingSystemId}
                      locale={user.locale}
                    />
                  </Link>
                ))}
              </div>
              {list.gradingSystemId === "upper_secondary_15_v1" && (
                <p className="text-xs text-muted-foreground">
                  {t.belowFive}:{" "}
                  {format.format(
                    list.subjects
                      .flatMap((subject) => subject.periods)
                      .filter(
                        (period) =>
                          period.period.position > 0 &&
                          period.enrolled &&
                          period.finalGrade !== null &&
                          period.finalGrade < 5,
                      ).length,
                  )}
                </p>
              )}
            </div>
          ) : (
            <TrendSummary
              trend={gradeTrend(
                list.gradingSystemId,
                average.basis === "PERIODS" ? [] : selectedEntries,
                selectedEntries.some((entry) => entry.groupId) || average.basis === "SUBJECTS"
                  ? (values) => calculateList({ ...list, entries: values }, position)
                  : undefined,
              )}
              systemId={list.gradingSystemId}
              locale={user.locale}
              wide
            />
          )}
        </div>
      </section>
      <section className="space-y-4" aria-label={t.subjects}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            {t.subjects}
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {format.format(visibleSubjects.length)}
            </span>
          </h2>
          {!readOnly && (
            <EntityEditor
              kind="subject"
              gradeListId={list.id}
              showCourseType={list.periodMode === "SEMESTERS"}
            />
          )}
        </div>
        {visibleSubjects.length === 0 ? (
          <p className="rounded-2xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">
            {list.subjects.length === 0 ? t.emptySubjects : t.noEnrolledSubjects}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleSubjects.map((subject) => (
              <li key={subject.id} className="min-w-0">
                <Link
                  className="interactive-surface group flex h-full flex-col items-stretch justify-between gap-3 rounded-2xl bg-card p-4 shadow-surface transition-colors hover:bg-accent/40 md:flex-row md:items-center xl:flex-col xl:items-stretch"
                  href={`/lists/${list.id}/subjects/${subject.id}?period=${position}`}
                >
                  <div className="min-w-0 space-y-2">
                    <h3 className="flex items-start gap-2 font-semibold">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary"
                        style={subject.color ? { backgroundColor: subject.color } : undefined}
                      />
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                        {subject.name}
                      </span>
                      {list.periodMode === "SEMESTERS" && (
                        <span className="text-xs text-muted-foreground">
                          {subject.isAdvanced ? t.advancedCourse : t.basicCourse}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {average.basis === "PERIODS" ? t.finalGradeCount : t.gradedEntries}:{" "}
                      {format.format(bySubject.get(subject.id)?.gradedCount ?? 0)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3">
                    <AverageDisplay
                      average={bySubject.get(subject.id) ?? emptyAverage}
                      systemId={list.gradingSystemId}
                      locale={user.locale}
                    />
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                    >
                      <path d="M5 12h14m-6-6 6 6-6 6" />
                    </svg>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <EntryTable entries={selectedEntries} {...choices} readOnly={readOnly} />
    </div>
  );
}
