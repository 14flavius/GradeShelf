"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import type { GradingSystemId } from "@/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/config";
import { messages } from "@/lib/i18n/messages";
import type { gradeTrend } from "@/lib/grades/trends";
import { formatAverage } from "@/lib/grades/averages";
import { formatCalendarDate } from "@/lib/grades/dates";
import { formatGrade, gradePoints, gradingSystems } from "@/lib/grades/systems";

export function TrendChart({
  points,
  systemId,
  locale,
}: {
  points: ReturnType<typeof gradeTrend>["points"];
  systemId: GradingSystemId;
  locale: Locale;
}) {
  const t = messages[locale];
  const id = useId();
  const figure = useRef<HTMLElement>(null);
  const control = useRef<HTMLButtonElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const system = gradingSystems[systemId];
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const min = gradePoints(systemId, system.min);
  const max = gradePoints(systemId, system.max);
  const y = (value: number) =>
    16 + ((system.direction === "LOWER_IS_BETTER" ? value - min : max - value) / (max - min)) * 104;
  const plotted = points.map((point, index) => ({
    ...point,
    x: 36 + (index * 308) / Math.max(1, points.length - 1),
    y: y(point.value),
  }));
  const active = activeIndex === null ? null : plotted[activeIndex];
  const activeY = active?.y;
  const positionLabel = (position: number) =>
    t.trendPosition.replace("{count}", format.format(position));
  const windowLabel = (point: (typeof points)[number]) =>
    t.trendWindow
      .replace("{from}", format.format(point.firstPosition))
      .replace("{to}", format.format(point.position));
  const pointLabel = (point: (typeof points)[number]) =>
    `${positionLabel(point.position)} · ${point.title} · ${formatCalendarDate(point.date, locale)} · ${t.gradeValue}: ${formatGrade(point.grade, systemId, locale)} · ${t.weight}: ${format.format(point.weight)} · ${t.trendPointAverage}: ${formatAverage(point.value, locale)} · ${windowLabel(point)}`;

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }
    function dismissOutside(event: globalThis.PointerEvent) {
      if (event.target instanceof Node && !figure.current?.contains(event.target)) {
        setActiveIndex(null);
      }
    }
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [activeIndex]);

  useLayoutEffect(() => {
    const chart = plot.current;
    const panel = detail.current;
    if (!chart || !panel || activeY === undefined) {
      return;
    }
    function positionDetail() {
      if (!chart || !panel || activeY === undefined) {
        return;
      }
      const bounds = chart.getBoundingClientRect();
      const height = panel.offsetHeight;
      const preferredTop = activeY < 68 ? bounds.height + 12 : -height - 12;
      // At the page bottom there may be no room below a point. Keep details in view.
      panel.style.top = `${Math.max(8 - bounds.top, Math.min(window.innerHeight - 8 - bounds.top - height, preferredTop))}px`;
      panel.style.visibility =
        bounds.bottom < 0 || bounds.top > window.innerHeight ? "hidden" : "visible";
    }
    positionDetail();
    window.addEventListener("resize", positionDetail);
    window.addEventListener("scroll", positionDetail, true);
    return () => {
      window.removeEventListener("resize", positionDetail);
      window.removeEventListener("scroll", positionDetail, true);
    };
  }, [activeY, activeIndex, locale, points]);

  function selectPoint(event: PointerEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 360;
    setActiveIndex(
      Math.max(0, Math.min(points.length - 1, Math.round(((x - 36) / 308) * (points.length - 1)))),
    );
  }

  function handlePointKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = activeIndex ?? points.length - 1;
    let next: number | null;
    switch (event.key) {
      case "ArrowLeft":
        next = Math.max(0, index - 1);
        break;
      case "ArrowRight":
        next = Math.min(points.length - 1, index + 1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = points.length - 1;
        break;
      case "Escape":
        next = null;
        break;
      default:
        return;
    }
    event.preventDefault();
    setActiveIndex(next);
  }

  return (
    <figure
      ref={figure}
      className={`relative mx-auto w-full min-w-0 max-w-lg ${active ? "z-30" : "z-10"}`}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch" && document.activeElement !== control.current) {
          setActiveIndex(null);
        }
      }}
    >
      <div ref={plot} className="relative">
        <svg
          role="img"
          aria-label={t.trendChart}
          data-grade-chart
          viewBox="0 0 360 136"
          width="360"
          height="136"
          className="block h-auto w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <title>{points.map(pointLabel).join("; ")}</title>
          {[min, (min + max) / 2, max].map((value) => (
            <path
              key={value}
              d={`M36 ${y(value)}H344`}
              className="stroke-border/70"
              strokeDasharray="3 5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {active && (
            <path
              d={`M${active.x} 12v112`}
              className="stroke-primary/40"
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <polyline
            points={plotted.map(({ x, y }) => `${x},${y}`).join(" ")}
            className="stroke-primary"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {plotted.map((point, index) => (
            <circle
              key={point.id}
              cx={point.x}
              cy={point.y}
              r={activeIndex === index ? "5" : index === plotted.length - 1 ? "4" : "3"}
              className={
                activeIndex === index
                  ? "fill-primary stroke-card"
                  : index === plotted.length - 1
                    ? "fill-card stroke-primary"
                    : "fill-primary"
              }
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            >
              <title>{pointLabel(point)}</title>
            </circle>
          ))}
        </svg>
        {[min, (min + max) / 2, max].map((value) => (
          <span
            key={value}
            aria-hidden="true"
            className="pointer-events-none absolute -translate-x-full -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
            style={{ left: `${(24 / 360) * 100}%`, top: `${(y(value) / 136) * 100}%` }}
          >
            {format.format(value)}
          </span>
        ))}
        <button
          ref={control}
          type="button"
          aria-label={t.trendExplore}
          aria-describedby={`${id}-help${active ? ` ${id}-detail` : ""}`}
          className="absolute inset-0 touch-pan-y cursor-crosshair rounded-lg bg-transparent focus-visible:outline-offset-2"
          onPointerDown={selectPoint}
          onPointerMove={selectPoint}
          onPointerCancel={() => setActiveIndex(null)}
          onFocus={() => setActiveIndex((index) => index ?? points.length - 1)}
          onBlur={(event) => {
            if (!figure.current?.contains(event.relatedTarget)) {
              setActiveIndex(null);
            }
          }}
          onClick={() => setActiveIndex((index) => index ?? points.length - 1)}
          onKeyDown={handlePointKeyDown}
        />
        {active && (
          <div
            ref={detail}
            id={`${id}-detail`}
            role="tooltip"
            aria-live="polite"
            aria-atomic="true"
            data-trend-tooltip
            data-position={active.position}
            className="absolute z-20 max-h-[calc(100dvh-1rem)] w-60 max-w-full overflow-y-auto rounded-xl border border-border/70 bg-card p-3 text-card-foreground shadow-lg"
            style={{
              left: `clamp(0px, calc(${(active.x / 360) * 100}% - 7.5rem), calc(100% - 15rem))`,
            }}
          >
            <p className="line-clamp-2 break-words text-sm font-semibold [overflow-wrap:anywhere]">
              {active.title || positionLabel(active.position)}
            </p>
            {active.subjectName && (
              <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {active.subjectName}
              </p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatCalendarDate(active.date, locale)} · {positionLabel(active.position)}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">{t.gradeValue}</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums">
                  {formatGrade(active.grade, systemId, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.weight}</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums">
                  {format.format(active.weight)}
                </dd>
              </div>
              <div className="col-span-2 flex items-center justify-between gap-3 border-t border-border/60 pt-2">
                <dt>
                  {t.trendPointAverage}
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {windowLabel(active)}
                  </span>
                </dt>
                <dd className="text-base font-semibold tabular-nums text-primary">
                  {formatAverage(active.value, locale)}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
      <div
        aria-hidden="true"
        className="ml-[10%] mr-[4.444%] flex justify-between gap-2 text-[11px] text-muted-foreground"
      >
        {[points[0], points[points.length - 1]].map((point, index) => (
          <div key={point.id} className={index ? "text-right" : undefined}>
            <p className="font-medium">{positionLabel(point.position)}</p>
            <p>{formatCalendarDate(point.date, locale)}</p>
          </div>
        ))}
      </div>
      <figcaption className="mt-4 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px] leading-relaxed text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full bg-primary" />
          {t.trendChartLegend}
        </p>
        <p id={`${id}-help`}>
          {t.trendInteract}
          <span className="sr-only"> {t.trendKeyboard}</span>
        </p>
        <p className="w-full">{t.trendWindowHelp}</p>
      </figcaption>
    </figure>
  );
}
