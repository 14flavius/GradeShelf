import Link from "next/link";
import type { PeriodMode } from "@/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/config";
import { messages } from "@/lib/i18n/messages";
import { periodCount, periodLabel } from "@/lib/grades/periods";

export function selectedPeriod(value: string | string[] | undefined, mode: PeriodMode) {
  const position = Number(value ?? 0);
  return Number.isInteger(position) && position >= 0 && position <= periodCount(mode)
    ? position
    : 0;
}

export function PeriodSelector({
  mode,
  position,
  href,
  locale,
}: {
  mode: PeriodMode;
  position: number;
  href: string;
  locale: Locale;
}) {
  if (mode === "NONE") {
    return null;
  }
  const t = messages[locale];
  return (
    <nav aria-label={t.periodMode} className="flex flex-wrap gap-2">
      {Array.from({ length: periodCount(mode) + 1 }, (_, index) => (
        <Link
          key={index}
          href={`${href}?period=${index}`}
          aria-current={position === index ? "page" : undefined}
          className={`rounded-xl px-4 py-2 text-sm ${position === index ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}
        >
          {index === 0 ? t.allPeriods : periodLabel(index, t)}
        </Link>
      ))}
    </nav>
  );
}
