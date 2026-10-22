import { readRequestBody } from "../request-body.ts";
import { ZodError } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Auth } from "../auth/core.ts";
import { readCurrentUser } from "../auth/access.ts";
import { getAuthEnvironment } from "../auth/environment.ts";
import { logEvent } from "../logger.mjs";
import { applyGradeMutation, GradeMutationError } from "./mutations.ts";

const errorStatuses: Record<GradeMutationError["code"], number> = {
  NOT_FOUND: 404,
  UNAUTHENTICATED: 401,
  PASSWORD_CHANGE_REQUIRED: 403,
  INVALID_INPUT: 400,
  IN_USE: 409,
  SCALE_LOCKED: 409,
  ARCHIVED: 409,
  TYPE_NAME_EXISTS: 409,
};

export async function handleGradeRequest(db: PrismaClient, auth: Auth, request: Request) {
  const json = (body: object, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    if (request.method !== "POST") {
      return json({ code: "INVALID_INPUT" }, 405);
    }
    if (request.headers.get("origin") !== getAuthEnvironment().baseURL) {
      return json({ code: "FORBIDDEN" }, 403);
    }
    const user = await readCurrentUser(db, auth, request.headers);
    if (!user) {
      return json({ code: "UNAUTHENTICATED" }, 401);
    }
    if (user.mustChangePassword) {
      return json({ code: "PASSWORD_CHANGE_REQUIRED" }, 403);
    }
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      return json({ code: "INVALID_INPUT" }, 415);
    }
    const bytes = await readRequestBody(request, 65536);
    if (bytes === null) {
      return json({ code: "INVALID_INPUT" }, 413);
    }
    let input: unknown;
    try {
      input = JSON.parse(bytes.toString("utf8"));
    } catch {
      return json({ code: "INVALID_INPUT" }, 400);
    }
    return json(await applyGradeMutation(db, user.id, input));
  } catch (error) {
    if (error instanceof ZodError) {
      return json({ code: "INVALID_INPUT" }, 400);
    }
    if (error instanceof GradeMutationError) {
      return json({ code: error.code }, errorStatuses[error.code]);
    }
    logEvent("grades.mutation_failed", "error");
    return json({ code: "UNAVAILABLE" }, 503);
  }
}
