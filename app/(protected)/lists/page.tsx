import { settingsSections } from "@/lib/settings-sections";
import type { Metadata } from "next";
import { CreateList } from "@/components/grades/create-list";
import { AverageDisplay } from "@/components/grades/average-display";
import { ArchiveButton } from "@/components/grades/archive-button";
import { getListStatistics } from "@/lib/grades/statistics";
import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { getRequestMessages } from "@/lib/i18n/server";
import { gradingSystems } from "@/lib/grades/systems";
import { EntityEditor } from "@/components/grades/entity-editor";
import { DeleteButton } from "@/components/grades/delete-button";
import { DefaultListButton } from "@/components/grades/default-list-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRequestMessages()).lists };
}

export default async function ListsPage() {
  const user = await requireUser();
  const t = await getRequestMessages();
  const db = await getDb();
  const [{ lists, overall }, types] = await Promise.all([
    getListStatistics(db, user.id),
    db.gradeType.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, weight: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const format = new Intl.NumberFormat(user.locale);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{t.lists}</h1>
          <span className="rounded-full bg-muted px-3 py-1 text-sm tabular-nums text-muted-foreground">
            {format.format(lists.length)}
          </span>
        </div>
        <CreateList types={types} />
      </div>
      <section className="space-y-4 rounded-2xl bg-card p-5" aria-label={t.overallAverages}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 className="font-semibold">{t.overallAverage}</h2>
          <Link
            href={{ pathname: "/settings", hash: settingsSections.dashboard }}
            className="inline-flex min-h-10 items-center text-sm text-primary underline-offset-4 hover:underline"
          >
            {t.configureOverall}
          </Link>
        </div>
        {overall.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noOverallLists}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {overall.map(({ systemId, average }) => (
              <div key={systemId} className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t[gradingSystems[systemId].labelKey]}
                </p>
                <AverageDisplay
                  average={average}
                  systemId={systemId}
                  locale={user.locale}
                  label="overallAverage"
                />
              </div>
            ))}
          </div>
        )}
      </section>
      {lists.length === 0 ? (
        <p className="rounded-2xl bg-muted/50 p-8 text-center text-muted-foreground">
          {t.emptyLists}
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {lists.map((list) => (
            <article
              key={list.id}
              className="panel relative flex h-full flex-col gap-4 pt-6 transition-colors hover:bg-accent/20"
            >
              <header className="space-y-3 px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {list.status === "ACTIVE" && (
                      <DefaultListButton id={list.id} name={list.name} isDefault={list.isDefault} />
                    )}
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${list.status === "ACTIVE" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      {list.status === "ACTIVE" ? t.active : t.archived}
                    </span>
                  </div>
                  <AverageDisplay
                    average={list.average}
                    systemId={list.gradingSystemId}
                    locale={user.locale}
                  />
                </div>
                <h2 className="min-w-0 text-xl font-semibold">
                  <Link
                    className="surface-action group flex items-start justify-between gap-3 hover:text-primary"
                    href={`/lists/${list.id}`}
                  >
                    <span className="break-words [overflow-wrap:anywhere]">{list.name}</span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-muted-foreground group-hover:text-primary"
                    >
                      →
                    </span>
                  </Link>
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t[gradingSystems[list.gradingSystemId].labelKey]}
                </p>
              </header>
              <div className="space-y-3 px-6">
                {list.description && (
                  <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {list.description}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  {t.subjects}: {format.format(list._count.subjects)}{" "}
                  <span aria-hidden="true" className="px-1">
                    ·
                  </span>{" "}
                  {t.entries}: {format.format(list._count.entries)}
                </p>
              </div>
              <details className="group relative z-10 mt-auto rounded-b-2xl bg-muted/30">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-b-2xl px-6 py-3 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <span>
                    {t.listActions}
                    <span className="sr-only">: {list.name}</span>
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="size-4 shrink-0 group-open:rotate-180"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <div className="space-y-3 px-6 pb-5 pt-2">
                  <p className="text-xs text-muted-foreground">
                    {list.includedInOverall ? t.includedInOverall : t.excludedFromOverall}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {list.status === "ACTIVE" && (
                      <EntityEditor
                        kind="list"
                        value={{
                          id: list.id,
                          name: list.name,
                          description: list.description,
                          gradingSystemId: list.gradingSystemId,
                          locked: !!list.gradingSystemLockedAt,
                          preferences: {
                            showOnDashboard: list.visibleOnDashboard,
                            includeInOverall: list.includedInOverall,
                          },
                        }}
                      />
                    )}
                    <ArchiveButton
                      id={list.id}
                      name={list.name}
                      archived={list.status === "ARCHIVED"}
                    />
                    {list.status === "ACTIVE" && (
                      <DeleteButton kind="list" id={list.id} name={list.name} />
                    )}
                  </div>
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
