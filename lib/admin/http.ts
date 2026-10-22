import { readRequestBody } from "../request-body.ts";
import { ZodError } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Auth } from "../auth/core.ts";
import { readCurrentUser } from "../auth/access.ts";
import { getAuthEnvironment } from "../auth/environment.ts";
import { logEvent } from "../logger.mjs";
import { AdminError, applyAdminCommand, assertAdmin } from "./service.ts";

const errorStatuses: Record<AdminError["code"], number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  PASSWORD_CHANGE_REQUIRED: 403,
  NOT_FOUND: 404,
  SELF_ACTION: 409,
  LAST_ADMIN: 409,
  USERNAME_TAKEN: 409,
  CONFIRMATION_REQUIRED: 409,
};

const json = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function adminErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return json({ code: "INVALID_INPUT" }, 400);
  }
  if (error instanceof AdminError) {
    return json({ code: error.code }, errorStatuses[error.code]);
  }
  logEvent("admin.operation_failed", "error");
  return json({ code: "UNAVAILABLE" }, 503);
}

export async function handleAdminRequest(db: PrismaClient, auth: Auth, request: Request) {
  try {
    if (request.method !== "POST") {
      return json({ code: "INVALID_INPUT" }, 405);
    }
    if (request.headers.get("origin") !== getAuthEnvironment().baseURL) {
      return json({ code: "FORBIDDEN" }, 403);
    }
    const user = await readCurrentUser(db, auth, request.headers);
    if (!user) {
      return adminErrorResponse(new AdminError("UNAUTHENTICATED"));
    }
    await assertAdmin(db, user.id);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      return json({ code: "INVALID_INPUT" }, 415);
    }
    const bytes = await readRequestBody(request, 8192);
    if (bytes === null) {
      return json({ code: "INVALID_INPUT" }, 413);
    }
    let input: unknown;
    try {
      input = JSON.parse(bytes.toString("utf8"));
    } catch {
      return json({ code: "INVALID_INPUT" }, 400);
    }
    return json(await applyAdminCommand(db, user.id, input));
  } catch (error) {
    return adminErrorResponse(error);
  }
}
