"use client";

import { useSyncExternalStore } from "react";
import { localCalendarDate } from "@/lib/grades/dates";

function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}

const browserDay = () => localCalendarDate();
const serverDay = () => "";

// The server does not know the browser's local day. Both consumers share this rule.
export function useLocalDay() {
  return useSyncExternalStore(subscribe, browserDay, serverDay);
}
