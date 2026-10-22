import type { PrismaClient } from "@/generated/prisma/client";
import type { Auth } from "../auth/core.ts";
import { readCurrentUser } from "../auth/access.ts";
import { logEvent } from "../logger.mjs";
import { recentCursorSchema, type RecentCursor } from "./dashboard.ts";
import { getRecentGrades } from "./dashboard-queries.ts";

const json = (body: object, status: number) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });

export function recentReadError() {
  logEvent("dashboard.read_failed", "error");
  return json({ code: "UNAVAILABLE" }, 503);
}

export async function handleRecentRead(db: PrismaClient, auth: Auth, request: Request) {
  try {
    const user = await readCurrentUser(db, auth, request.headers);
    if (!user) {
      return json({ code: "UNAUTHENTICATED" }, 401);
    }
    if (user.mustChangePassword) {
      return json({ code: "PASSWORD_CHANGE_REQUIRED" }, 403);
    }
    const raw = new URL(request.url).searchParams.get("cursor");
    let cursor: RecentCursor | undefined;
    if (raw !== null) {
      try {
        if (raw.length > 512) {
          return json({ code: "INVALID_INPUT" }, 400);
        }
        cursor = recentCursorSchema.parse(JSON.parse(raw));
      } catch {
        return json({ code: "INVALID_INPUT" }, 400);
      }
    }
    return json(await getRecentGrades(db, user.id, cursor), 200);
  } catch {
    return recentReadError();
  }
}
