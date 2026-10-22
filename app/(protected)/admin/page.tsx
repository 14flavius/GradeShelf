import { readInstanceName } from "@/lib/admin/instance";
import { InstanceSettings } from "@/components/admin/instance-settings";
import type { Metadata } from "next";
import { getRequestMessages } from "@/lib/i18n/server";
import { requireUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { listAdminUsers } from "@/lib/admin/service";
import { AdminUsers } from "@/components/admin/users";
import { ImprintSettingsForm } from "@/components/admin/imprint-settings";
import { readImprint } from "@/lib/admin/imprint";
import { readAdminContact } from "@/lib/admin/contact";
import { ContactSettings } from "@/components/admin/contact-settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRequestMessages()).admin };
}

export default async function AdminPage() {
  const user = await requireUser({ admin: true });
  const db = await getDb();
  const [users, settings, contact, instanceName, t] = await Promise.all([
    listAdminUsers(db, user.id),
    readImprint(db),
    readAdminContact(db),
    readInstanceName(db),
    getRequestMessages(),
  ]);
  return (
    <AdminUsers users={users} currentUserId={user.id}>
      <details className="group rounded-2xl bg-card text-card-foreground shadow-surface">
        <summary className="flex cursor-pointer list-none items-center gap-4 rounded-2xl p-5 motion-safe:transition-colors hover:bg-accent/40 sm:p-6 [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="size-5"
            >
              <path d="M4 6h6m4 0h6M4 12h10m4 0h2M4 18h2m4 0h10" />
              <path d="M10 3v6m4 0v6M6 15v6" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t.instanceSettings}</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {t.instanceSettingsSummary}
            </span>
          </span>
          <span className="hidden max-w-48 truncate rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground sm:block">
            {instanceName || "GradeShelf"}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 shrink-0 text-muted-foreground group-open:rotate-180"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="grid items-start gap-8 border-t border-border/60 p-5 sm:p-6 lg:grid-cols-2 lg:gap-10">
          <div className="space-y-8">
            <InstanceSettings name={instanceName} />
            <ContactSettings contact={contact} />
          </div>
          <ImprintSettingsForm settings={settings} />
        </div>
      </details>
    </AdminUsers>
  );
}
