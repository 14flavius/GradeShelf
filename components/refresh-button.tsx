"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { refreshData } from "@/app/actions/refresh";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { REFRESH_COOLDOWN_MS } from "@/lib/refresh";
import type { MessageKey } from "@/lib/i18n/messages";

export function RefreshButton() {
  const { t } = useLanguage();
  const tooltipId = useId();
  const [pending, startTransition] = useTransition();
  const locked = useRef(false);
  const [now, setNow] = useState(0);
  const [retryAt, setRetryAt] = useState(0);
  const [spinUntil, setSpinUntil] = useState(0);
  const [successUntil, setSuccessUntil] = useState(0);
  const [showCountdown, setShowCountdown] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const secondsLeft = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const spinning = pending || now < spinUntil;
  const success = !spinning && now < successUntil;
  const countdownVisible = showCountdown && secondsLeft > 0;
  const unavailable = spinning || secondsLeft > 0;
  const ticking = pending || now < Math.max(retryAt, spinUntil, successUntil);

  useEffect(() => {
    if (!ticking) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [ticking]);

  function reload() {
    const startedAt = Date.now();
    if (locked.current || pending || startedAt < retryAt) {
      setShowCountdown(true);
      return;
    }
    locked.current = true;
    setNow(startedAt);
    setRetryAt(startedAt + REFRESH_COOLDOWN_MS);
    setSpinUntil(startedAt + 350);
    setSuccessUntil(0);
    setError(null);
    setShowCountdown(false);
    startTransition(async () => {
      try {
        const result = await refreshData();
        const receivedAt = Date.now();
        setNow(receivedAt);
        setRetryAt(receivedAt + result.retryAfterMs);
        if (result.error) {
          setError(result.error);
        } else if (result.refreshed) {
          setSuccessUntil(Math.max(receivedAt, startedAt + 350) + 2000);
        }
      } catch {
        setError("refreshFailed");
      } finally {
        locked.current = false;
      }
    });
  }

  const countdown = t.refreshCountdown.replace("{seconds}", String(secondsLeft));
  const label = error
    ? t[error]
    : spinning
      ? t.refreshingData
      : success
        ? t.refreshDone
        : t.refreshData;
  const hint = secondsLeft > 0 ? `${label} · ${countdown}` : label;

  return (
    <div className="relative shrink-0">
      <Button
        variant="secondary"
        className={`relative size-11 px-0 ${unavailable ? "cursor-default" : ""}`}
        aria-label={t.refreshData}
        aria-describedby={tooltipId}
        aria-busy={spinning}
        aria-disabled={unavailable}
        onClick={reload}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch" && Date.now() < retryAt) {
            setShowCountdown(true);
          }
        }}
        onPointerLeave={() => setShowCountdown(false)}
      >
        <span
          className={`relative size-6 motion-safe:transition-[opacity,translate] motion-safe:duration-[400ms] motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)] ${countdownVisible ? "opacity-0 motion-safe:-translate-y-0.5" : "translate-y-0 opacity-100"}`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`absolute inset-0 size-6 motion-safe:transition-opacity motion-safe:duration-[400ms] motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)] ${success ? "opacity-0" : "opacity-100"} ${spinning ? "motion-safe:animate-spin [animation-duration:650ms]" : ""}`}
          >
            <path d="M4 10a8 8 0 0 1 14-3l2 3M20 4v6h-6" />
            <path d="M20 14a8 8 0 0 1-14 3l-2-3M4 20v-6h6" />
          </svg>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`absolute inset-0 size-6 text-primary motion-safe:transition-[opacity,scale] motion-safe:duration-[400ms] motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)] ${success ? "scale-100 opacity-100" : "motion-safe:scale-95 opacity-0"}`}
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
        </span>
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium tabular-nums motion-safe:transition-[opacity,translate] motion-safe:duration-[400ms] motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)] ${countdownVisible ? "translate-y-0 opacity-100" : "opacity-0 motion-safe:translate-y-0.5"}`}
        >
          {Math.max(1, secondsLeft)}
        </span>
      </Button>
      <span id={tooltipId} role="tooltip" className="sr-only">
        {hint}
      </span>
      {error ? (
        <span
          role="alert"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl bg-card p-3 text-xs text-destructive shadow-lg"
        >
          {t[error]}
        </span>
      ) : (
        <span className="sr-only" role="status">
          {success ? t.refreshDone : ""}
        </span>
      )}
    </div>
  );
}
