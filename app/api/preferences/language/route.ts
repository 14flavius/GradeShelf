import { getAuth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { changeLanguage } from "@/lib/i18n/preference";
import { logEvent } from "@/lib/logger.mjs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return await changeLanguage(await getDb(), await getAuth(), request);
  } catch {
    logEvent("preferences.update_failed", "error");
    return Response.json(
      { code: "UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
