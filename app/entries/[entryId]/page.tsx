import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { entryReturnPath, withReturnPath } from "@/lib/auth/return-path";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { getRequestMessages } from "@/lib/i18n/server";
import { getEntryDetails } from "@/lib/grades/entry-details";
import { getEntryChoices } from "@/lib/grades/queries";
import { gradingSystems } from "@/lib/grades/systems";
import { EntryTable } from "@/components/grades/entry-table";
import { EntryLink } from "@/components/grades/entry-link";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRequestMessages()).entryDetails };
}

export default async function EntryPage({ params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const target = entryReturnPath(`/entries/${entryId}`);
  const user = await getCurrentUser();
  if (!user) {
    redirect(withReturnPath("/login", target));
  }
  if (user.mustChangePassword) {
    redirect(withReturnPath("/change-password", target));
  }
  const entry = await getEntryDetails(await getDb(), user.id, entryId);
  if (!entry) {
    notFound();
  }
  const [t, choices] = await Promise.all([getRequestMessages(), getEntryChoices(user.id)]);
  const readOnly = entry.gradeList.status === "ARCHIVED";
  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-3xl space-y-6">
        <nav
          aria-label={t.subject}
          className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground"
        >
          <Link
            href={`/lists/${entry.gradeListId}`}
            className="inline-flex min-h-10 items-center break-words hover:text-foreground"
          >
            {entry.gradeList.name}
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/lists/${entry.gradeListId}/subjects/${entry.subjectId}`}
            className="inline-flex min-h-10 items-center break-words hover:text-foreground"
          >
            {entry.subject.name}
          </Link>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{t.entryDetails}</h1>
            <p className="text-sm text-muted-foreground">
              {t[gradingSystems[entry.gradeList.gradingSystemId].labelKey]}
            </p>
          </div>
          <EntryLink id={entry.id} title={entry.title} compact={false} />
        </div>
        {readOnly && <p className="text-sm text-muted-foreground">{t.archivedReadOnly}</p>}
        <EntryTable
          entries={[entry]}
          {...choices}
          readOnly={readOnly}
          showSubject={false}
          focused
        />
      </div>
    </AppShell>
  );
}
