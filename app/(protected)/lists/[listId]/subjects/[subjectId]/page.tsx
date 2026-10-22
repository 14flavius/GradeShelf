import type { Metadata } from "next";
import { gradeTrend } from "@/lib/grades/trends";
import { TrendSummary } from "@/components/grades/trend-summary";
import { AverageDisplay } from "@/components/grades/average-display";
import { weightedAverage } from "@/lib/grades/averages";
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
}: {
  params: Promise<{ listId: string; subjectId: string }>;
}) {
  const user = await requireUser();
  const { listId, subjectId } = await params;
  const db = await getDb();
  const subject = await db.subject.findFirst({
    where: { id: subjectId, gradeListId: listId, userId: user.id },
  });
  const list = await db.gradeList.findFirst({
    where: { id: listId, userId: user.id },
    select: { name: true, status: true, gradingSystemId: true },
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
  const average = weightedAverage(list.gradingSystemId, entries);
  const format = new Intl.NumberFormat(user.locale);
  return (
    <div className="space-y-6">
      <Link
        href={`/lists/${listId}`}
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
              <EntryEditor {...choices} gradeListId={listId} subjectId={subjectId} />
              <PageActions label={t.subjectActions}>
                <EntityEditor
                  kind="subject"
                  gradeListId={listId}
                  value={{ id: subject.id, name: subject.name, color: subject.color }}
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
              ? `${t.gradedEntries}: ${format.format(average.gradedCount)}`
              : t.noGradedEntries}
          </p>
        </div>
        <div className="min-w-0 border-t border-border/60 pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <TrendSummary
            trend={gradeTrend(list.gradingSystemId, entries)}
            systemId={list.gradingSystemId}
            locale={user.locale}
            wide
          />
        </div>
      </section>
      <EntryTable entries={entries} {...choices} readOnly={readOnly} showSubject={false} />
    </div>
  );
}
