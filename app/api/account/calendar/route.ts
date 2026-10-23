import { getAuth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { handleCalendarSettings } from "@/lib/calendar/http";
import { logEvent } from "@/lib/logger.mjs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return await handleCalendarSettings(await getDb(), await getAuth(), request);
  } catch {
    logEvent("calendar.settings_unavailable", "error");
    return Response.json(
      { code: "UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
