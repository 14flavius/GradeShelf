import { readRequestBody } from "../request-body.ts";
import type { Auth } from "./core.ts";
import { exposedAuthPaths } from "./validation.ts";
import { logEvent } from "../logger.mjs";
import { getAuthEnvironment } from "./environment.ts";

export async function handleAuthRequest(auth: Auth | (() => Promise<Auth>), request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  if (!exposedAuthPaths.has(path)) {
    return Response.json({ message: "Nicht gefunden." }, { status: 404 });
  }
  const callback = path === "/callback/oidc";
  const methods = callback ? ["GET", "POST"] : [path === "/get-session" ? "GET" : "POST"];
  if (!methods.includes(request.method)) {
    return Response.json({ message: "Methode nicht erlaubt." }, { status: 405 });
  }
  if (
    ["/sign-in/social", "/link-social", "/unlink-account"].includes(path) &&
    request.headers.get("origin") !== getAuthEnvironment().baseURL
  ) {
    return Response.json({ code: "FORBIDDEN" }, { status: 403 });
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
    const resolvedAuth = typeof auth === "function" ? await auth() : auth;
    const response = await resolvedAuth.handler(request);
    response.headers.set("Cache-Control", "no-store");
    if (callback) {
      const location = response.headers.get("location");
      if (location) {
        const target = new URL(location, getAuthEnvironment().baseURL);
        if (
          target.origin === getAuthEnvironment().baseURL &&
          ["/login", "/settings"].includes(target.pathname) &&
          target.searchParams.has("error")
        ) {
          const code = target.searchParams.get("error");
          const status =
            code === "SSO_REAUTH_REQUIRED"
              ? "reauth"
              : ["signup_disabled", "account_not_linked", "SSO_NOT_LINKED"].includes(code ?? "")
                ? "unlinked"
                : "error";
          // Provider error descriptions can contain private details. Render only
          // our own translated messages and keep them out of browser history.
          target.search = new URLSearchParams({ sso: status }).toString();
          response.headers.set("Location", target.toString());
          logEvent("auth.sso_failed");
        } else if (response.status >= 300 && response.status < 400) {
          logEvent("auth.sso_completed");
        }
      }
      if (response.status >= 400) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: `${getAuthEnvironment().baseURL}/login?sso=error`,
            "Cache-Control": "no-store",
          },
        });
      }
    }
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
    if (callback) {
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
