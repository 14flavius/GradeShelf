import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Auth } from "../auth/core.ts";
import { readCurrentUser } from "../auth/access.ts";
import { getAuthEnvironment } from "../auth/environment.ts";
import { logEvent } from "../logger.mjs";
import { readRequestBody } from "../request-body.ts";
import { themeSchema } from "../theme.ts";
import { readExport, streamExport } from "./service.ts";

const exportInput = z.strictObject({ theme: themeSchema.default("system") });
const error = (code: string, status: number) =>
  Response.json({ code }, { status, headers: { "Cache-Control": "no-store" } });
const activeExports = new Set<string>();

export function exportErrorResponse() {
  logEvent("export.prepare_failed", "error");
  return error("EXPORT_FAILED", 503);
}

export async function handleExport(db: PrismaClient, auth: Auth, request: Request) {
  let exportingUser: string | undefined;
  let streaming = false;
  try {
    if (request.headers.get("origin") !== getAuthEnvironment().baseURL) {
      return error("FORBIDDEN", 403);
    }
    const user = await readCurrentUser(db, auth, request.headers);
    if (!user) {
      return error("UNAUTHENTICATED", 401);
    }
    if (user.mustChangePassword) {
      return error("PASSWORD_CHANGE_REQUIRED", 403);
    }
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      return error("INVALID_INPUT", 415);
    }
    const body = await readRequestBody(request, 1024);
    if (body === null) {
      return error("INVALID_INPUT", 413);
    }
    let input;
    try {
      input = exportInput.safeParse(JSON.parse(body.toString("utf8")));
    } catch {
      return error("INVALID_INPUT", 400);
    }
    if (!input.success) {
      return error("INVALID_INPUT", 400);
    }
    if (activeExports.has(user.id) || activeExports.size >= 2) {
      return error("EXPORT_BUSY", 429);
    }
    activeExports.add(user.id);
    exportingUser = user.id;
    const snapshot = await readExport(db, user.id, input.data.theme);
    if (!snapshot) {
      return error("UNAUTHENTICATED", 401);
    }
    const response = new Response(
      streamExport(snapshot, request.signal, () => activeExports.delete(user.id)),
      {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${snapshot.filename}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox; default-src 'none'",
          "Cross-Origin-Resource-Policy": "same-origin",
        },
      },
    );
    streaming = true;
    return response;
  } catch {
    return exportErrorResponse();
  } finally {
    if (exportingUser && !streaming) {
      activeExports.delete(exportingUser);
    }
  }
}
