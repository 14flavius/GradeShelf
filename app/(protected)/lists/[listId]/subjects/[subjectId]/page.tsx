import { TargetCalculator } from "@/components/grades/target-calculator";
import { calculationSubjectSelect } from "@/lib/grades/calculation-data";
import { PeriodSelector, selectedPeriod } from "@/components/grades/period-selector";
import { PeriodEditor, GroupEditor } from "@/components/grades/period-editor";
import { periodCount, periodLabel } from "@/lib/grades/periods";
import { formatGrade } from "@/lib/grades/systems";
import type { Metadata } from "next";
import { gradeTrend } from "@/lib/grades/trends";
import { TrendSummary } from "@/components/grades/trend-summary";
import { AverageDisplay } from "@/components/grades/average-display";
import { calculateSubject } from "@/lib/grades/averages";
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
  return { title: (await getRequestMessages()).subject };
}

export default async function SubjectPage({
  params,
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
  params: Promise<{ listId: string; subjectId: string }>;
}) {
  const user = await requireUser();
  const { listId, subjectId } = await params;
  const db = await getDb();
  const subject = await db.subject.findFirst({
    where: { id: subjectId, gradeListId: listId, userId: user.id },
    select: calculationSubjectSelect(user.id),
  });
  const list = await db.gradeList.findFirst({
    where: { id: listId, userId: user.id },
    select: { name: true, status: true, gradingSystemId: true, periodMode: true },
  });
  if (!subject || !list) {
    notFound();
  }
  const [t, choices, entries] = await Promise.all([
    getRequestMessages(),
    getEntryChoices(user.id),
    getEntries(user.id, listId, subjectId),
  ]);
  const readOnly = list.status === "ARCHIVED";
  const position = selectedPeriod((await searchParams).period, list.periodMode);
  const selectedEntries =
    position === 0
      ? entries
      : entries.filter((entry) => entry.subjectPeriod?.period.position === position);
  const average = calculateSubject(list, subject, entries, position);
  const choice = choices.lists.find((item) => item.id === listId);
  const activePeriods = subject.periods.filter(
    (item) => item.period.position <= periodCount(list.periodMode),
  );
  const periods = activePeriods.filter((item) =>
    list.periodMode === "NONE"
      ? item.period.position === 0
      : item.period.position > 0 && (position === 0 || item.period.position === position),
  );
  const format = new Intl.NumberFormat(user.locale);
  const selectedSettings = subject.periods.find(
    (period) => period.period.position === (list.periodMode === "SCHOOL_YEAR" ? 0 : position),
  );
  return (
    <div className="space-y-6">
      <Link
        href={`/lists/${listId}?period=${position}`}
        className="inline-flex min-h-10 items-center gap-2 rounded-sm text-sm text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden="true">←</span>
        <span className="break-words [overflow-wrap:anywhere]">{list.name}</span>
      </Link>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-full bg-primary"
                style={subject.color ? { backgroundColor: subject.color } : undefined}
              />
              <h1 className="break-words text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
                {subject.name}
              </h1>
              {readOnly && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {t.archived}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {t[gradingSystems[list.gradingSystemId].labelKey]}
            </p>
            {readOnly && <p className="text-sm text-muted-foreground">{t.archivedReadOnly}</p>}
          </div>
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <EntryEditor
                {...choices}
                gradeListId={listId}
                subjectId={subjectId}
                periodPosition={position}
              />
              <PageActions label={t.subjectActions}>
                <EntityEditor
                  kind="subject"
                  gradeListId={listId}
                  showCourseType={list.periodMode === "SEMESTERS"}
                  value={{
                    id: subject.id,
                    name: subject.name,
                    color: subject.color,
                    isAdvanced: subject.isAdvanced,
                  }}
                />
                <DeleteButton
                  kind="subject"
                  id={subject.id}
                  name={subject.name}
                  returnTo={`/lists/${listId}`}
                />
              </PageActions>
            </div>
          )}
        </div>
      </header>
      <PeriodSelector
        mode={list.periodMode}
        position={position}
        href={`/lists/${listId}/subjects/${subjectId}`}
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
          {average.basis === "PERIODS" ? (
            <p className="text-sm text-muted-foreground">{t.finalGradeHelp}</p>
          ) : (
            <TrendSummary
              trend={gradeTrend(
                list.gradingSystemId,
                selectedEntries,
                selectedEntries.some((entry) => entry.groupId) || average.basis === "TYPES"
                  ? (values) => calculateSubject(list, subject, values, position)
                  : undefined,
              )}
              systemId={list.gradingSystemId}
              locale={user.locale}
              wide
            />
          )}
        </div>
      </section>
      {selectedSettings?.weightingMode === "PERCENTAGES" &&
        !(list.periodMode === "SEMESTERS" && position === 0) && (
          <p className="text-sm text-muted-foreground">
            {selectedSettings.shares
              .map(
                (share) =>
                  `${choices.types.find((type) => type.id === share.gradeTypeId)?.name ?? "—"}: ${format.format(share.share / 100)} %`,
              )
              .join(" · ")}
          </p>
        )}
      {list.periodMode !== "SEMESTERS" &&
        position === 0 &&
        selectedSettings?.finalGrade != null && (
          <p className="text-sm">
            {t.finalGrade}:{" "}
            {formatGrade(selectedSettings.finalGrade, list.gradingSystemId, user.locale)}
          </p>
        )}
      {list.periodMode === "SEMESTERS" && (
        <p className="text-sm text-muted-foreground">
          {subject.isAdvanced ? t.advancedCourse : t.basicCourse}
        </p>
      )}
      {list.periodMode !== "NONE" && (
        <section className="grid gap-3 sm:grid-cols-2" aria-label={t.periodOverview}>
          {periods.map((period) => (
            <div key={period.id} className="panel space-y-3 p-4">
              <h2 className="font-semibold">{periodLabel(period.period.position, t)}</h2>
              <p className="text-sm">{period.enrolled ? t.enrolled : t.notEnrolled}</p>
              {period.enrolled && (
                <>
                  {position === 0 && (
                    <>
                      <p className="text-sm text-muted-foreground">{t.currentAverage}</p>
                      <AverageDisplay
                        average={calculateSubject(list, subject, entries, period.period.position)}
                        systemId={list.gradingSystemId}
                        locale={user.locale}
                      />
                    </>
                  )}
                  <p className="text-sm">
                    {t.finalGrade}:{" "}
                    {period.finalGrade === null
                      ? "—"
                      : formatGrade(period.finalGrade, list.gradingSystemId, user.locale)}
                  </p>
                </>
              )}
              {!readOnly && choice && (
                <PeriodEditor
                  list={choice}
                  subject={subject}
                  period={period}
                  entries={entries}
                  types={choices.types}
                />
              )}
            </div>
          ))}
        </section>
      )}
      {!readOnly && choice && (
        <details className="panel space-y-4 p-4">
          <summary className="cursor-pointer font-medium">{t.additionalOptions}</summary>
          {list.periodMode !== "SEMESTERS" &&
            activePeriods
              .filter((item) => item.period.position === 0)
              .map((period) => (
                <PeriodEditor
                  key={period.id}
                  list={choice}
                  subject={subject}
                  period={period}
                  entries={entries}
                  types={choices.types}
                />
              ))}
          <p className="text-sm text-muted-foreground">{t.groupHelp}</p>
          <div className="flex flex-wrap gap-2">
            {activePeriods
              .filter((item) => position === 0 || item.period.position === position)
              .flatMap((period) =>
                period.groups.map((group) => (
                  <GroupEditor
                    key={group.id}
                    group={group}
                    periodId={period.id}
                    label={
                      list.periodMode === "NONE"
                        ? group.name
                        : `${periodLabel(period.period.position, t)} · ${group.name}`
                    }
                  />
                )),
              )}
          </div>
        </details>
      )}
      {!readOnly && choice && (
        <TargetCalculator
          list={choice}
          subject={subject}
          entries={entries}
          types={choices.types}
          position={position}
        />
      )}
      <EntryTable entries={selectedEntries} {...choices} readOnly={readOnly} showSubject={false} />
    </div>
  );
}
