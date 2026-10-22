import { settingsSections } from "@/lib/settings-sections";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { readExport } from "@/lib/export/service";
import { getRequestMessages } from "@/lib/i18n/server";
import { formatAverage, overallAverages, weightedAverage } from "@/lib/grades/averages";
import { formatCalendarDate } from "@/lib/grades/dates";
import { formatGrade, gradingSystems } from "@/lib/grades/systems";
import { PrintReport } from "@/components/settings/print-report";
import styles from "./report.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const user = await requireUser();
  return {
    title: { absolute: `GradeShelf - ${user.username} - ${new Date().toISOString().slice(0, 10)}` },
    robots: { index: false, follow: false },
  };
}

export default async function PdfReportPage() {
  const user = await requireUser();
  const [snapshot, t] = await Promise.all([
    readExport(await getDb(), user.id, "system"),
    getRequestMessages(),
  ]);
  if (!snapshot) {
    notFound();
  }
  const data = snapshot.data;
  const format = new Intl.NumberFormat(user.locale, { maximumFractionDigits: 2 });
  const types = new Map(data.gradeTypes.map((type) => [type.id, type]));
  const lists = data.gradeLists.map((list) => ({
    ...list,
    dashboardPreference:
      data.dashboardPreferences.find((preference) => preference.gradeListId === list.id) ?? null,
    entries: data.gradeEntries.filter((entry) => entry.gradeListId === list.id),
  }));
  const overall = overallAverages(lists);
  return (
    <main className={styles.report}>
      <div className={styles.toolbar}>
        <Link href={{ pathname: "/settings", hash: settingsSections.dataExport }}>
          ← {t.settings}
        </Link>
        <PrintReport />
      </div>
      <article>
        <header className={styles.header}>
          <p className={styles.brand}>GradeShelf</p>
          <h1>{t.pdfReportTitle}</h1>
          <p className={styles.owner}>
            {user.name || user.username}
            <span>@{user.username}</span>
          </p>
          <p className={styles.muted}>
            {t.pdfCreated}:{" "}
            {new Intl.DateTimeFormat(user.locale, {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: "UTC",
            }).format(data.exportedAt)}{" "}
            UTC
          </p>
        </header>
        <div className={styles.stats}>
          {[
            [t.lists, data.gradeLists.length],
            [t.subjects, data.subjects.length],
            [t.entries, data.gradeEntries.length],
            [t.gradedEntries, data.gradeEntries.filter((entry) => entry.grade !== null).length],
          ].map(([label, count]) => (
            <div key={label}>
              <strong>{format.format(Number(count))}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <section className={styles.overall} aria-label={t.overallAverages}>
          <h2>{t.overallAverage}</h2>
          {overall.length ? (
            overall.map(({ systemId, average }) => (
              <p key={systemId}>
                {t[gradingSystems[systemId].labelKey]}{" "}
                <strong>
                  {average.value === null ? "—" : formatAverage(average.value, user.locale)}
                </strong>
              </p>
            ))
          ) : (
            <p>{t.noOverallLists}</p>
          )}
          <p className={styles.muted}>{t.pdfAverageHelp}</p>
        </section>
        {lists.length === 0 && <p>{t.emptyLists}</p>}
        {lists.map((list, index) => {
          const average = weightedAverage(list.gradingSystemId, list.entries);
          const subjects = data.subjects
            .filter((subject) => subject.gradeListId === list.id)
            .sort((a, b) => a.name.localeCompare(b.name, user.locale));
          return (
            <section key={list.id} className={styles.list}>
              <header className={styles.listHeader}>
                <p className={styles.eyebrow}>
                  {t.gradeList} {format.format(index + 1)} ·{" "}
                  {list.status === "ARCHIVED" ? t.archived : t.active}
                </p>
                <div>
                  <h2>{list.name}</h2>
                  <p className={styles.average}>
                    Ø {average.value === null ? "—" : formatAverage(average.value, user.locale)}
                  </p>
                </div>
                <p className={styles.muted}>{t[gradingSystems[list.gradingSystemId].labelKey]}</p>
                {list.description && <p className={styles.note}>{list.description}</p>}
                <p className={styles.muted}>
                  {t.showOnDashboard}:{" "}
                  {list.status === "ACTIVE" && list.dashboardPreference?.showOnDashboard
                    ? t.pdfYes
                    : t.pdfNo}{" "}
                  · {t.includeInOverall}:{" "}
                  {list.status === "ACTIVE" && list.dashboardPreference?.includeInOverall
                    ? t.pdfYes
                    : t.pdfNo}
                </p>
              </header>
              {subjects.length === 0 && <p>{t.emptySubjects}</p>}
              {subjects.map((subject) => {
                const entries = list.entries
                  .filter((entry) => entry.subjectId === subject.id)
                  .sort(
                    (a, b) =>
                      b.date.localeCompare(a.date) ||
                      (b.gradedAt?.getTime() ?? 0) - (a.gradedAt?.getTime() ?? 0) ||
                      a.id.localeCompare(b.id),
                  );
                const average = weightedAverage(list.gradingSystemId, entries);
                return (
                  <section key={subject.id} className={styles.subject}>
                    <h3>
                      {subject.name}
                      <span>
                        Ø {average.value === null ? "—" : formatAverage(average.value, user.locale)}
                      </span>
                    </h3>
                    {!entries.length ? (
                      <p className={styles.muted}>{t.emptyEntries}</p>
                    ) : (
                      <table>
                        <colgroup>
                          <col style={{ width: "18%" }} />
                          <col style={{ width: "33%" }} />
                          <col style={{ width: "23%" }} />
                          <col style={{ width: "14%" }} />
                          <col style={{ width: "12%" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th scope="col">{t.entryDate}</th>
                            <th scope="col">{t.entryTitle}</th>
                            <th scope="col">{t.gradeType}</th>
                            <th scope="col">{t.weight}</th>
                            <th scope="col">{t.gradeValue}</th>
                          </tr>
                        </thead>
                        {entries.map((entry) => {
                          const attachments = data.attachments.filter(
                            (file) => file.gradeEntryId === entry.id,
                          );
                          return (
                            <tbody key={entry.id}>
                              <tr>
                                <td>{formatCalendarDate(entry.date, user.locale)}</td>
                                <td>
                                  <strong>{entry.title}</strong>
                                </td>
                                <td>{types.get(entry.gradeTypeId)?.name}</td>
                                <td>{format.format(entry.weight)}</td>
                                <td>
                                  <strong>
                                    {entry.grade === null
                                      ? "—"
                                      : formatGrade(entry.grade, list.gradingSystemId, user.locale)}
                                  </strong>
                                </td>
                              </tr>
                              {(entry.note || attachments.length > 0) && (
                                <tr className={styles.detailRow}>
                                  <td colSpan={5} className={styles.detail}>
                                    {entry.note && (
                                      <div>
                                        <strong>
                                          {t.entryNote}: {entry.title}
                                        </strong>
                                        <p className={styles.note}>{entry.note}</p>
                                      </div>
                                    )}
                                    {attachments.length > 0 && (
                                      <div>
                                        <strong>{t.attachments}</strong>
                                        <ul>
                                          {attachments.map((file) => (
                                            <li key={file.id}>
                                              {file.originalName}{" "}
                                              <span className={styles.muted}>
                                                ({format.format(file.size)} {t.pdfBytes})
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          );
                        })}
                      </table>
                    )}
                  </section>
                );
              })}
            </section>
          );
        })}
        {data.gradeTypes.length > 0 && (
          <section className={styles.types}>
            <h2>{t.gradeTypes}</h2>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.name}</th>
                  <th scope="col">{t.weight}</th>
                </tr>
              </thead>
              <tbody>
                {data.gradeTypes.map((type) => (
                  <tr key={type.id}>
                    <td>{type.name}</td>
                    <td>{format.format(type.weight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <footer className={styles.footer}>
          <strong>GradeShelf</strong>
          <p>{t.pdfReportHelp}</p>
          <p>{t.pdfUngradedHelp}</p>
        </footer>
      </article>
    </main>
  );
}
