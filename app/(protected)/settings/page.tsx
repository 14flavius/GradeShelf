import { CalendarFeedSettings } from "@/components/settings/calendar-feed";
import { readCalendarSettings } from "@/lib/calendar/service";
import { settingsSections } from "@/lib/settings-sections";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { GradeTypes } from "@/components/grades/grade-types";
import { getRequestMessages } from "@/lib/i18n/server";
import { requireUser } from "@/lib/auth/server";
import { PasswordForm } from "@/components/auth/password-form";
import { TwoFactorSettings } from "@/components/auth/two-factor-settings";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { DashboardPreferences } from "@/components/grades/dashboard-preferences";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { DisplayNameForm } from "@/components/auth/display-name-form";
import { SetupTutorial } from "@/components/onboarding/setup-tutorial";
import { InstallApp } from "@/components/install-app";
import { DataExport } from "@/components/settings/data-export";
import { StorageUsage } from "@/components/attachments/storage-usage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRequestMessages()).settings };
}

export default async function SettingsPage() {
  const t = await getRequestMessages();
  const user = await requireUser();
  const db = await getDb();
  const types = await db.gradeType.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, weight: true },
  });
  const lists = await db.gradeList.findMany({
    where: { userId: user.id },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      status: true,
      dashboardPreference: { select: { showOnDashboard: true, includeInOverall: true } },
    },
  });
  const calendar = await readCalendarSettings(db, user.id, user.locale);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{t.settings}</h1>
        <InstallApp />
      </div>
      <section
        id="profile"
        className="panel scroll-mt-6 space-y-5 p-6"
        aria-labelledby="profile-heading"
      >
        <header className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary"
          >
            {(user.name || user.username || "G").slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h2 id="profile-heading" className="text-xl font-semibold">
              {t.profileSettings}
            </h2>
            <p className="text-xs text-muted-foreground">@{user.username}</p>
          </div>
        </header>
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
          <DisplayNameForm
            name={user.name || user.username || "GradeShelf"}
            username={user.username ?? "GradeShelf"}
          />
          <div className="space-y-3 rounded-2xl bg-muted/40 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <LanguageSwitcher />
              <ThemeSwitcher />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t.themeDeviceHint}</p>
          </div>
        </div>
      </section>
      <section
        id={settingsSections.security}
        className="scroll-mt-6 space-y-3"
        aria-labelledby="security-heading"
      >
        <h2 id="security-heading" className="text-xl font-semibold">
          {t.securitySettings}
        </h2>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <SettingsPanel id="password-settings" title={t.changePassword}>
            <p className="mb-4 text-sm text-muted-foreground">{t.otherSessions}</p>
            <PasswordForm />
          </SettingsPanel>
          <TwoFactorSettings
            enabled={user.twoFactorEnabled}
            username={user.username ?? "GradeShelf"}
          />
        </div>
      </section>
      <GradeTypes types={types} />
      <DashboardPreferences lists={lists} />
      <CalendarFeedSettings initial={calendar} lists={lists} />
      <DataExport />
      <section
        id="storage"
        className="panel scroll-mt-6 space-y-3 p-6"
        aria-labelledby="storage-heading"
      >
        <h2 id="storage-heading" className="text-xl font-semibold">
          {t.attachmentStorage}
        </h2>
        <StorageUsage />
      </section>
      <section
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card px-6 py-5 shadow-surface"
        aria-labelledby="tutorial-heading"
      >
        <div>
          <h2 id="tutorial-heading" className="font-semibold">
            {t.tutorialSettings}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.tutorialSettingsHelp}</p>
        </div>
        <SetupTutorial userId={user.id} availableTypes={types} replay />
      </section>
    </div>
  );
}
