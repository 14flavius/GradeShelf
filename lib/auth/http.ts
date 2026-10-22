import { readRequestBody } from "../request-body.ts";
import type { Auth } from "./core.ts";
import { exposedAuthPaths } from "./validation.ts";
import { logEvent } from "../logger.mjs";

export async function handleAuthRequest(auth: Auth, request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  if (!exposedAuthPaths.has(path)) {
    return Response.json({ message: "Nicht gefunden." }, { status: 404 });
  }
  if (request.method !== (path === "/get-session" ? "GET" : "POST")) {
    return Response.json({ message: "Methode nicht erlaubt." }, { status: 405 });
  }
  try {
    // Bound authentication payloads before Better Auth parses JSON, including chunked requests.
    if (request.method === "POST" && request.body) {
      const bytes = await readRequestBody(request, 8192);
      if (bytes === null) {
        return Response.json(
          { message: "Anfrage zu groß." },
          { status: 413, headers: { "Cache-Control": "no-store" } },
        );
      }
      request = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: bytes,
      });
    }
    const response = await auth.handler(request);
    response.headers.set("Cache-Control", "no-store");
    if (
      path === "/sign-in/username" ||
      path === "/two-factor/verify-totp" ||
      path === "/two-factor/verify-backup-code"
    ) {
      const data = response.ok ? await response.clone().json() : null;
      logEvent(
        response.ok
          ? data?.twoFactorRedirect
            ? "auth.second_factor_required"
            : "auth.login_succeeded"
          : "auth.login_failed",
      );
    }
    if (response.status >= 500) {
      logEvent("auth.request_failed", "error");
      return Response.json(
        { message: "Anmeldung derzeit nicht verfügbar." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return response;
  } catch {
    logEvent("auth.request_failed", "error");
    return Response.json(
      { message: "Anmeldung derzeit nicht verfügbar." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
