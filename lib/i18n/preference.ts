import { readRequestBody } from "../request-body.ts";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Auth } from "../auth/core.ts";
import { readCurrentUser } from "../auth/access.ts";
import { getAuthEnvironment } from "../auth/environment.ts";
import { localeCookie, localeSchema } from "./config.ts";

const preferenceSchema = z.object({ locale: localeSchema }).strict();

export async function changeLanguage(db: PrismaClient, auth: Auth, request: Request) {
  const { baseURL } = getAuthEnvironment();
  const headers = { "Cache-Control": "no-store" };
  if (request.headers.get("origin") !== baseURL) {
    return Response.json({ code: "INVALID_ORIGIN" }, { status: 403, headers });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return Response.json({ code: "INVALID_INPUT" }, { status: 415, headers });
  }
  const bytes = await readRequestBody(request, 1024);
  if (bytes === null) {
    return Response.json({ code: "INVALID_INPUT" }, { status: 413, headers });
  }
  let body: unknown;
  try {
    body = JSON.parse(bytes.toString("utf8"));
  } catch {
    return Response.json({ code: "INVALID_INPUT" }, { status: 400, headers });
  }
  const parsed = preferenceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ code: "INVALID_INPUT" }, { status: 400, headers });
  }
  const { locale } = parsed.data;
  const user = await readCurrentUser(db, auth, request.headers);
  // Guests only change this browser's language. Account IDs are never accepted as input.
  if (user) {
    await db.user.updateMany({
      where: { id: user.id, isActive: true },
      data: { locale, localeSelected: true },
    });
  }
  return Response.json(
    { locale },
    {
      headers: {
        ...headers,
        "Set-Cookie": `${localeCookie}=${locale}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${baseURL.startsWith("https:") ? "; Secure" : ""}`,
      },
    },
  );
}
