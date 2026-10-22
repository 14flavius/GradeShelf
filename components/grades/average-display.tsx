import type { GradingSystemId } from "@/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/config";
import { messages, type MessageKey } from "@/lib/i18n/messages";
import { gradingSystems, letterGrades } from "@/lib/grades/systems";
import { formatAverage, type Average } from "@/lib/grades/averages";

export function AverageDisplay({
  average,
  systemId,
  locale,
  label = "weightedAverage",
}: {
  average: Average;
  systemId: GradingSystemId;
  locale: Locale;
  label?: MessageKey;
}) {
  const t = messages[locale];
  const system = gradingSystems[systemId];
  const units = { PERCENT: "%", POINTS: t.pointsUnit, GRADE: t.gradeUnit };
  const unit = letterGrades(systemId) ? t.letterAverageUnit : units[system.unit];
  const count = new Intl.NumberFormat(locale).format(average.gradedCount);
  return (
    <div className="space-y-1" data-average-system={systemId}>
      <p className="sr-only">{t[label]}</p>
      <p className="flex flex-wrap items-baseline gap-2">
        <span aria-hidden="true" className="text-sm text-muted-foreground">
          Ø
        </span>
        <output aria-label={t[label]} className="text-2xl font-semibold tabular-nums">
          {average.value === null ? "—" : formatAverage(average.value, locale)}
        </output>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </p>
      <p className="sr-only">
        {t[system.labelKey]} ·{" "}
        {system.direction === "LOWER_IS_BETTER" ? t.lowerBetter : t.higherBetter}
      </p>
      <p className="sr-only">
        {average.value === null ? t.noGradedEntries : `${t.gradedEntries}: ${count}`}
      </p>
    </div>
  );
}
