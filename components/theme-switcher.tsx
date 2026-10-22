"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { resolveTheme, themeStorageKey, type Theme } from "@/lib/theme";

const changeEvent = "gradeshelf-theme-change";

function subscribe(notify: () => void) {
  function syncOtherTab(event: StorageEvent) {
    if (event.key !== themeStorageKey && event.key !== null) {
      return;
    }
    document.documentElement.dataset.theme = resolveTheme(event.newValue);
    notify();
  }
  window.addEventListener(changeEvent, notify);
  window.addEventListener("storage", syncOtherTab);
  return () => {
    window.removeEventListener(changeEvent, notify);
    window.removeEventListener("storage", syncOtherTab);
  };
}

const getSnapshot = () => resolveTheme(document.documentElement.dataset.theme);
const getServerSnapshot = (): Theme => "system";

export function ThemeSwitcher() {
  const { t } = useLanguage();
  const id = useId();
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [saveFailed, setSaveFailed] = useState(false);
  return (
    <div className="w-full min-w-0 space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {t.appearance}
      </label>
      <select
        id={id}
        value={theme}
        className="min-h-11 w-full rounded-xl border border-input bg-field py-2 pl-3 text-sm"
        onChange={(event) => {
          const selected = resolveTheme(event.target.value);
          document.documentElement.dataset.theme = selected;
          setSaveFailed(false);
          try {
            localStorage.setItem(themeStorageKey, selected);
          } catch {
            setSaveFailed(true);
          }
          window.dispatchEvent(new Event(changeEvent));
        }}
      >
        <option value="system">{t.themeSystem}</option>
        <option value="dark">{t.themeDark}</option>
        <option value="light">{t.themeLight}</option>
      </select>
      {saveFailed && (
        <p role="alert" className="text-sm text-destructive">
          {t.themeSaveFailed}
        </p>
      )}
    </div>
  );
}
