import { getAuth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { handleGradeRequest } from "@/lib/grades/http";
import { logEvent } from "@/lib/logger.mjs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return await handleGradeRequest(await getDb(), await getAuth(), request);
  } catch {
    logEvent("grades.unavailable", "error");
    return Response.json(
      { code: "UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
