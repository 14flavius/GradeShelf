"use client";

import { settingsSections } from "@/lib/settings-sections";
import Link from "next/link";
import { useState, type SubmitEvent } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { MutationError } from "./form-parts";
import { useGradeMutation } from "./use-grade-mutation";

type ListPreference = {
  id: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED";
  dashboardPreference: { showOnDashboard: boolean; includeInOverall: boolean } | null;
};

export function DashboardPreferences({ lists }: { lists: ListPreference[] }) {
  const { t } = useLanguage();
  return (
    <section
      id={settingsSections.dashboard}
      className="panel scroll-mt-6 space-y-4 p-6"
      aria-labelledby="dashboard-preferences-heading"
    >
      <h2 id="dashboard-preferences-heading" className="text-xl font-semibold">
        {t.dashboardSettings}
      </h2>
      {lists.length === 0 ? (
        <p className="rounded-lg bg-muted/50 p-5 text-center text-sm text-muted-foreground">
          {t.emptyLists}{" "}
          <Link href="/lists" className="underline">
            {t.lists}
          </Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {lists.map((list) => (
            <li key={list.id} className="min-w-0 rounded-xl bg-muted/40 p-4">
              <PreferenceForm list={list} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PreferenceForm({ list }: { list: ListPreference }) {
  const { t } = useLanguage();
  const mutation = useGradeMutation();
  const [saved, setSaved] = useState(false);
  const archived = list.status === "ARCHIVED";
  const show = !archived && list.dashboardPreference?.showOnDashboard === true;
  const include = !archived && list.dashboardPreference?.includeInOverall === true;
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const data = new FormData(event.currentTarget);
    if (
      await mutation.run({
        action: "list.preferences",
        id: list.id,
        data: { showOnDashboard: data.has("show"), includeInOverall: data.has("include") },
      })
    ) {
      setSaved(true);
    }
  }

  return (
    <form
      className="space-y-2"
      aria-label={`${t.dashboardSettings}: ${list.name}`}
      onChange={() => setSaved(false)}
      onSubmit={handleSubmit}
    >
      <div className="grid items-center gap-x-6 gap-y-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <h3 className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">
          <Link
            href={`/lists/${list.id}`}
            className="hover:text-primary hover:underline underline-offset-4"
          >
            {list.name}
          </Link>
        </h3>
        <fieldset
          key={`${show}-${include}-${archived}`}
          disabled={mutation.pending || archived}
          className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem] disabled:opacity-60"
        >
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="show"
              defaultChecked={show}
              className="size-5 shrink-0 accent-primary"
            />
            {t.showOnDashboard}
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="include"
              defaultChecked={include}
              className="size-5 shrink-0 accent-primary"
            />
            {t.includeInOverall}
          </label>
          {archived ? (
            <span className="text-xs text-muted-foreground">{t.archived}</span>
          ) : (
            <Button
              type="submit"
              variant="secondary"
              className="justify-self-start"
              disabled={mutation.pending}
            >
              {mutation.pending ? t.saving : t.save}
            </Button>
          )}
        </fieldset>
      </div>
      {archived && <p className="text-xs text-muted-foreground">{t.archivedPreferencesHelp}</p>}
      <MutationError message={mutation.error} />
      {saved && (
        <p role="status" className="text-sm">
          {t.preferencesSaved}
        </p>
      )}
    </form>
  );
}
