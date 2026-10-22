import type { GradingSystemId } from "@/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/config";
import { messages } from "@/lib/i18n/messages";
import { formatAverage } from "@/lib/grades/averages";
import type { gradeTrend } from "@/lib/grades/trends";
import { AverageDisplay } from "./average-display";
import { TrendChart } from "./trend-chart";

export function TrendSummary({
  trend,
  systemId,
  locale,
  wide = false,
}: {
  trend: ReturnType<typeof gradeTrend>;
  systemId: GradingSystemId;
  locale: Locale;
  wide?: boolean;
}) {
  const t = messages[locale];
  const labels = {
    INSUFFICIENT: t.trendInsufficient,
    IMPROVING: t.trendImproving,
    DECLINING: t.trendDeclining,
    STABLE: t.trendStable,
  };
  const points = trend.points;
  const compared = points.length >= 2;
  const last = points.at(-1);
  const count = last ? last.position - last.firstPosition + 1 : 0;
  const currentLabel = t.trendCurrent.replace(
    "{count}",
    new Intl.NumberFormat(locale).format(count),
  );
  return (
    <div
      className={
        wide && compared
          ? "grid min-w-0 items-center gap-5 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.6fr)] lg:gap-8"
          : "min-w-0 space-y-5"
      }
      data-trend-status={trend.status}
    >
      <div
        className={`flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 ${wide && compared ? "lg:flex-col lg:items-start lg:gap-5" : ""}`}
      >
        {compared && (
          <div className="space-y-1 [&_output]:text-3xl [&_output]:tracking-tight">
            <p className="text-xs text-muted-foreground">{currentLabel}</p>
            <AverageDisplay
              average={{ value: trend.current, gradedCount: count }}
              systemId={systemId}
              locale={locale}
              label="trendRecentAverage"
            />
          </div>
        )}
        <div className="min-w-0 space-y-2">
          <p
            className={`inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${trend.status === "IMPROVING" ? "bg-success/8 text-[light-dark(#047857,#6ee7b7)]" : trend.status === "DECLINING" ? "bg-[light-dark(#fef3c7,#392c18)] text-[light-dark(#92400e,#fbbf24)]" : "bg-muted/60 text-muted-foreground"}`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5 shrink-0"
            >
              <path
                d={
                  trend.status === "IMPROVING"
                    ? "m3 17 6-6 4 4 8-11M15 4h6v6"
                    : trend.status === "DECLINING"
                      ? "m3 7 6 6 4-4 8 11m-6 0h6v-6"
                      : "M4 12h16m-5-5 5 5-5 5"
                }
              />
            </svg>
            {labels[trend.status].replace(
              "{difference}",
              formatAverage(Math.abs(trend.difference ?? 0), locale),
            )}
          </p>
          {compared ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground" title={t.trendMethod}>
              <span className="font-medium tabular-nums">
                {formatAverage(points[0].value, locale)} →{" "}
                {formatAverage(points[points.length - 1].value, locale)}
              </span>
              <span> · {t.trendVisibleRange}</span>
              <span className="sr-only">. {t.trendMethod}</span>
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">{t.trendMinimum}</p>
          )}
        </div>
      </div>
      {compared && <TrendChart points={points} systemId={systemId} locale={locale} />}
    </div>
  );
}
