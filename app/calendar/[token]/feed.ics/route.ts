import { getDb } from "@/lib/db";
import { getAuthEnvironment } from "@/lib/auth/environment";
import { getCalendarFeedReader } from "@/lib/calendar/feed";
import { logEvent } from "@/lib/logger.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function serve(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const reader = getCalendarFeedReader(await getDb());
    return await reader(request, token, getAuthEnvironment().baseURL);
  } catch {
    logEvent("calendar.feed_unavailable", "error");
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  }
}

export const GET = serve;
export const HEAD = serve;
