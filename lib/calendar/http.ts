import { ZodError } from "zod";
import type { PrismaClient } from "../../generated/prisma/client.ts";
import type { Auth } from "../auth/core.ts";
import { readCurrentUser } from "../auth/access.ts";
import { getAuthEnvironment } from "../auth/environment.ts";
import { readRequestBody } from "../request-body.ts";
import { logEvent } from "../logger.mjs";
import { applyCalendarCommand, CalendarError } from "./service.ts";

export async function handleCalendarSettings(db: PrismaClient, auth: Auth, request: Request) {
  const json = (body: object, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    if (request.method !== "POST") {
      return json({ code: "INVALID_INPUT" }, 405);
    }
    const { baseURL } = getAuthEnvironment();
    if (request.headers.get("origin") !== baseURL) {
      return json({ code: "FORBIDDEN" }, 403);
    }
    const user = await readCurrentUser(db, auth, request.headers);
    if (!user) {
      return json({ code: "UNAUTHENTICATED" }, 401);
    }
    if (user.mustChangePassword) {
      return json({ code: "FORBIDDEN" }, 403);
    }
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      return json({ code: "INVALID_INPUT" }, 415);
    }
    const bytes = await readRequestBody(request, 80 * 1024);
    if (bytes === null) {
      return json({ code: "INVALID_INPUT" }, 413);
    }
    let input: unknown;
    try {
      input = JSON.parse(bytes.toString("utf8"));
    } catch {
      return json({ code: "INVALID_INPUT" }, 400);
    }
    return json(await applyCalendarCommand(db, user.id, input, baseURL));
  } catch (error) {
    if (error instanceof ZodError) {
      return json({ code: "INVALID_INPUT" }, 400);
    }
    if (error instanceof CalendarError) {
      return json(
        { code: error.code },
        error.code === "CONFLICT" ? 409 : error.code === "FORBIDDEN" ? 403 : 400,
      );
    }
    logEvent("calendar.settings_failed", "error");
    return json({ code: "UNAVAILABLE" }, 503);
  }
}
