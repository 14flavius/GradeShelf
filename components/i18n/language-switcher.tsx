"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { localeSchema, type Locale } from "@/lib/i18n/config";
import { useLanguage } from "./provider";

export function LanguageSwitcher({
  disabled = false,
  compact = false,
}: {
  disabled?: boolean;
  compact?: boolean;
}) {
  const { locale, t } = useLanguage();
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  function handleLanguageChange(language: Locale) {
    if (pending || disabled) {
      return;
    }
    setFailed(false);
    startTransition(async () => {
      try {
        const response = await fetch("/api/preferences/language", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: language }),
        });
        if (!response.ok) {
          setFailed(true);
        } else {
          router.refresh();
        }
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div className="w-full min-w-0 space-y-2" aria-busy={pending}>
      {compact ? (
        <div
          role="group"
          aria-label={t.language}
          className="relative inline-grid grid-cols-2 rounded-full bg-muted p-1"
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-1 left-1 rounded-full bg-card shadow-sm motion-safe:transition-[translate] motion-safe:duration-[450ms] motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)] ${locale === "de" ? "translate-x-full" : "translate-x-0"}`}
            style={{ width: "calc((100% - 0.5rem) / 2)" }}
          />
          {(["en", "de"] as const).map((language) => (
            <button
              key={language}
              type="button"
              lang={language}
              aria-pressed={locale === language}
              disabled={pending || disabled}
              onClick={() => handleLanguageChange(language)}
              className={`relative min-h-10 rounded-full px-3 text-xs font-medium motion-safe:transition-[color,opacity] motion-safe:duration-[450ms] disabled:cursor-default sm:px-4 ${locale === language ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {language === "en" ? "English" : "Deutsch"}
            </button>
          ))}
        </div>
      ) : (
        <>
          <label htmlFor={id} className="block text-sm font-medium">
            {t.language}
          </label>
          <select
            id={id}
            value={locale}
            disabled={pending || disabled}
            className="min-h-11 w-full rounded-xl border border-input bg-field py-2 pl-3 text-sm disabled:opacity-60"
            onChange={(event) => {
              const language = localeSchema.safeParse(event.target.value);
              if (language.success) {
                handleLanguageChange(language.data);
              }
            }}
          >
            <option value="en" lang="en">
              English
            </option>
            <option value="de" lang="de">
              Deutsch
            </option>
          </select>
        </>
      )}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t.languageFailed}
        </p>
      )}
    </div>
  );
}
