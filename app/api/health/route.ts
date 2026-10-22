import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/logger.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    // Also checks that the initial migration has been applied; never reads user data.
    await db.$queryRaw /* language=SQLite */ `SELECT 1 FROM "user" LIMIT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    logEvent("health.database_unavailable", "error");
    return Response.json(
      { status: "unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
