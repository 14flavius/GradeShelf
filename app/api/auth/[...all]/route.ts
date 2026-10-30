import { getAuth, getSsoAuth } from "@/lib/auth/server";
import { getAuthEnvironment } from "@/lib/auth/environment";
import { handleAuthRequest } from "@/lib/auth/http";
import { logEvent } from "@/lib/logger.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const path = new URL(request.url).pathname;
  const ssoRequest = [
    "/api/auth/sign-in/social",
    "/api/auth/link-social",
    "/api/auth/callback/oidc",
  ].includes(path);
  try {
    return await handleAuthRequest(ssoRequest ? getSsoAuth : getAuth, request);
  } catch {
    logEvent("auth.unavailable", "error");
    if (path === "/api/auth/callback/oidc") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${getAuthEnvironment().baseURL}/login?sso=error`,
          "Cache-Control": "no-store",
        },
      });
    }
    return Response.json(
      { message: "Anmeldung derzeit nicht verfügbar." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export { handler as GET, handler as POST };
