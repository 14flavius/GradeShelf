import { browserLocale } from "../i18n/config.ts";
import { isAPIError } from "better-auth/api";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Auth } from "./core.ts";

export async function readCurrentUser(db: PrismaClient, auth: Auth, headers: Headers) {
  const session = await auth.api
    .getSession({ headers, query: { disableCookieCache: true, disableRefresh: true } })
    .catch((error: unknown) => {
      if (isAPIError(error) && error.statusCode === 401) {
        return null;
      }
      throw error;
    });
  if (!session) {
    return null;
  }
  const user = await db.user.findFirst({
    where: { id: session.user.id, isActive: true },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      mustChangePassword: true,
      twoFactorEnabled: true,
      locale: true,
      localeSelected: true,
    },
  });
  return user && { ...user, locale: user.localeSelected ? user.locale : browserLocale(headers) };
}

export function accessRedirect(
  user: Awaited<ReturnType<typeof readCurrentUser>>,
  options: { allowPasswordChange?: boolean; admin?: boolean } = {},
) {
  if (!user) {
    return "/login";
  }
  if (user.mustChangePassword && !options.allowPasswordChange) {
    return "/change-password";
  }
  if (options.admin && user.role !== "ADMIN") {
    return "/dashboard";
  }
  return null;
}
