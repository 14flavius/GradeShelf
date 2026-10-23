import type { Locale } from "../i18n/config.ts";
import { entryStatus, formatCalendarDate, localCalendarDate } from "../grades/dates.ts";
import { formatGrade } from "../grades/systems.ts";
import type { GradingSystemId } from "../../generated/prisma/enums.ts";
import { messages } from "../i18n/messages.ts";
import type { CalendarSettings, CalendarVariable } from "./validation.ts";

export type CalendarEntry = {
  id: string;
  title: string;
  date: string;
  grade: number | null;
  weight: number;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  gradeList: { name: string; gradingSystemId: GradingSystemId; updatedAt: Date };
  subject: { name: string; updatedAt: Date };
  gradeType: { name: string; updatedAt: Date };
};

// Substituted values are never parsed again. A note containing {url} stays literal.
function substitute(template: string, values: Record<CalendarVariable, string>, limit: number) {
  let result = "";
  const parts = template.split(/(\{[a-z]+\})/);
  for (const part of parts) {
    const key = part.slice(1, -1);
    const value =
      part.startsWith("{") && Object.hasOwn(values, key) ? values[key as CalendarVariable] : part;
    result += value.slice(0, limit - result.length);
    if (result.length >= limit) {
      break;
    }
  }
  // Do not split an astral character at the output limit.
  return result.replace(/[\uD800-\uDBFF]$/, "");
}

export function calendarPreview(
  entry: CalendarEntry,
  settings: Pick<CalendarSettings, "titleTemplate" | "descriptionTemplate" | "locale">,
  baseURL: string,
  today = localCalendarDate(),
) {
  const locale: Locale = settings.locale;
  const t = messages[locale];
  const status = entryStatus(entry.date, entry.grade, today);
  const values: Record<CalendarVariable, string> = {
    title: entry.title,
    subject: entry.subject.name,
    list: entry.gradeList.name,
    type: entry.gradeType.name,
    date: formatCalendarDate(entry.date, locale),
    status: status === "GRADED" ? t.graded : status === "UPCOMING" ? t.upcoming : t.pendingGrade,
    grade:
      entry.grade === null ? "" : formatGrade(entry.grade, entry.gradeList.gradingSystemId, locale),
    weight: new Intl.NumberFormat(locale).format(entry.weight),
    note: entry.note ?? "",
    url: `${baseURL}/entries/${encodeURIComponent(entry.id)}`,
  };
  return {
    title: substitute(settings.titleTemplate, values, 500).replace(/[\r\n]+/g, " "),
    description: substitute(settings.descriptionTemplate, values, 20000),
    url: values.url,
  };
}

export function escapeCalendarText(value: string) {
  return value
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

// RFC 5545 folds at 75 UTF-8 octets, including the continuation's leading space.
export function calendarLine(value: string) {
  let line = "";
  let bytes = 0;
  let output = "";
  for (const character of value) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > 75) {
      output += `${line}\r\n`;
      line = " ";
      bytes = 1;
    }
    line += character;
    bytes += size;
  }
  return `${output}${line}\r\n`;
}

function timestamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function calendarHeader(name: string) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GradeShelf//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    `NAME:${escapeCalendarText(name)}`,
    `X-WR-CALNAME:${escapeCalendarText(name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1M",
    "X-PUBLISHED-TTL:PT1M",
  ]
    .map(calendarLine)
    .join("");
}

export function calendarEvent(
  entry: CalendarEntry,
  feed: Pick<CalendarSettings, "titleTemplate" | "descriptionTemplate" | "locale"> & {
    id: string;
    updatedAt: Date;
  },
  baseURL: string,
  today = localCalendarDate(),
) {
  const preview = calendarPreview(entry, feed, baseURL, today);
  const nextDay = new Date(`${entry.date}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  // Status follows the server's calendar day; event dates themselves stay timezone-free.
  const statusChangedAt = new Date(`${entry.date}T00:00:00`);
  statusChangedAt.setDate(statusChangedAt.getDate() + 1);
  // Include related names and templates so their edits update existing events as well.
  const modified = new Date(
    Math.max(
      entry.updatedAt.getTime(),
      entry.subject.updatedAt.getTime(),
      entry.gradeList.updatedAt.getTime(),
      entry.gradeType.updatedAt.getTime(),
      feed.updatedAt.getTime(),
      entry.grade === null &&
        entry.date < today &&
        /\{status\}/.test(feed.titleTemplate + feed.descriptionTemplate)
        ? statusChangedAt.getTime()
        : 0,
    ),
  );
  return [
    "BEGIN:VEVENT",
    `UID:${entry.id}.${feed.id}@gradeshelf.invalid`,
    `DTSTAMP:${timestamp(modified)}`,
    `CREATED:${timestamp(entry.createdAt)}`,
    `LAST-MODIFIED:${timestamp(modified)}`,
    `DTSTART;VALUE=DATE:${entry.date.replaceAll("-", "")}`,
    // Without DTEND, a DATE event lasts one day (RFC 5545). Use that default at
    // the maximum four-digit year rather than emitting an invalid year 10000.
    ...(nextDay.getUTCFullYear() <= 9999
      ? [`DTEND;VALUE=DATE:${nextDay.toISOString().slice(0, 10).replaceAll("-", "")}`]
      : []),
    `SUMMARY:${escapeCalendarText(preview.title)}`,
    `DESCRIPTION:${escapeCalendarText(preview.description)}`,
    `URL:${preview.url}`,
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ]
    .map(calendarLine)
    .join("");
}
