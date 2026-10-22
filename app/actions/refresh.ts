"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { claimRefresh } from "@/lib/refresh";
import { logEvent } from "@/lib/logger.mjs";
import type { MessageKey } from "@/lib/i18n/messages";

export async function refreshData(): Promise<{
  refreshed: boolean;
  retryAfterMs: number;
  error?: MessageKey;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { refreshed: false, retryAfterMs: 0, error: "gradeSignIn" };
    }
    if (user.mustChangePassword) {
      return { refreshed: false, retryAfterMs: 0, error: "passwordRequired" };
    }
    const result = await claimRefresh(await getDb(), user.id);
    if (result.allowed) {
      refresh();
    }
    return { refreshed: result.allowed, retryAfterMs: result.retryAfterMs };
  } catch {
    logEvent("data.refresh_failed", "error");
    return { refreshed: false, retryAfterMs: 0, error: "refreshFailed" };
  }
}
