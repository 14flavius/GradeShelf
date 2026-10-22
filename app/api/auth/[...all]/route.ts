import { getAuth } from "@/lib/auth/server";
import { handleAuthRequest } from "@/lib/auth/http";
import { logEvent } from "@/lib/logger.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  try {
    return await handleAuthRequest(await getAuth(), request);
  } catch {
    logEvent("auth.unavailable", "error");
    return Response.json(
      { message: "Anmeldung derzeit nicht verfügbar." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export { handler as GET, handler as POST };
