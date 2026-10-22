import type { Locale } from "../i18n/config.ts";

export function localCalendarDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function entryStatus(date: string, grade: number | null, today: string) {
  if (grade !== null) {
    return "GRADED";
  }
  return date >= today ? "UPCOMING" : "PENDING_GRADE";
}

export function formatCalendarDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
