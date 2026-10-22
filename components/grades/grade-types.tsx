"use client";

import { settingsSections } from "@/lib/settings-sections";
import { useLanguage } from "@/components/i18n/provider";
import type { TypeChoice } from "@/lib/grades/types";
import { EntityEditor } from "./entity-editor";
import { DeleteButton } from "./delete-button";

export function GradeTypes({ types }: { types: TypeChoice[] }) {
  const { t, locale } = useLanguage();
  return (
    <section
      id={settingsSections.gradeTypes}
      className="panel scroll-mt-6 space-y-4 p-6"
      aria-labelledby="grade-types-heading"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="grade-types-heading" className="flex items-center gap-2 text-xl font-semibold">
          {t.gradeTypes}
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {new Intl.NumberFormat(locale).format(types.length)}
          </span>
        </h2>
        <EntityEditor kind="type" />
      </header>
      {types.length === 0 ? (
        <p className="rounded-lg bg-muted/50 p-5 text-center text-sm text-muted-foreground">
          {t.emptyTypes}
        </p>
      ) : (
        <ul className="space-y-2">
          {types.map((type) => (
            <li
              key={type.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-label={`${t.weight}: ${new Intl.NumberFormat(locale).format(type.weight)}`}
                  className="flex min-h-10 min-w-11 shrink-0 items-center justify-center rounded-lg bg-card px-2 text-sm font-semibold tabular-nums"
                >
                  ×{new Intl.NumberFormat(locale).format(type.weight)}
                </span>
                <h3 className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">
                  {type.name}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <EntityEditor kind="type" value={type} />
                <DeleteButton kind="type" id={type.id} name={type.name} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
