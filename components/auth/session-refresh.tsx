"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth/client";

const minimumInterval = 60 * 60 * 1000;
// Module scope survives client navigations that remount the app shell.
let lastRequest = 0;

function refresh() {
  if (document.visibilityState !== "visible" || Date.now() - lastRequest < minimumInterval) {
    return;
  }
  lastRequest = Date.now();
  // Best effort: a failed refresh leaves the session unchanged and the next
  // check retries; the server still enforces expiry on every request.
  authClient.getSession().catch(() => undefined);
}

// Server Components read the session without refreshing it, because they cannot
// set cookies. This route request lets Better Auth extend an active session
// (at most once per day) so regular use does not end in a fixed logout.
export function SessionRefresh() {
  useEffect(() => {
    refresh();
    // The interval covers tabs that stay visible for days without a focus change.
    const timer = window.setInterval(refresh, minimumInterval);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return null;
}
