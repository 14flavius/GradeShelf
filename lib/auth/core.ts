import { getAuthEnvironment } from "./environment.ts";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";
import { twoFactor, username } from "better-auth/plugins";
import type { PrismaClient } from "@/generated/prisma/client";
import { logEvent } from "../logger.mjs";
import { authBodies, exposedAuthPaths, usernameSchema } from "./validation.ts";

export function createAuth(db: PrismaClient) {
  const environment = getAuthEnvironment();
  return betterAuth({
    appName: "GradeShelf",
    ...environment,
    database: prismaAdapter(db, { provider: "sqlite", transaction: true }),
    trustedOrigins: [environment.baseURL],
    telemetry: { enabled: false },
    logger: { level: "error", log: () => logEvent("auth.internal_error", "error") },
    onAPIError: {
      onError: (error) => {
        if (!isAPIError(error) || error.statusCode >= 500) {
          logEvent("auth.internal_error", "error");
        }
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    user: {
      additionalFields: {
        locale: { type: ["en", "de"], defaultValue: "en", input: false },
        role: { type: ["USER", "ADMIN"], defaultValue: "USER", input: false },
        isActive: { type: "boolean", defaultValue: true, input: false },
        mustChangePassword: { type: "boolean", defaultValue: true, input: false },
        isUnusedDefaultAdmin: {
          type: "boolean",
          defaultValue: false,
          input: false,
          returned: false,
        },
      },
    },
    advanced: {
      // No trusted proxy is configured: never accept spoofable forwarding headers.
      // Better Auth uses its shared per-path bucket when no trusted IP is available.
      ipAddress: { ipAddressHeaders: [] },
      useSecureCookies: environment.baseURL.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/username": { window: 60, max: 10 },
        "/change-password": { window: 60, max: 5 },
        "/two-factor/*": { window: 60, max: 10 },
      },
    },
    plugins: [
      username({
        displayUsername: false,
        immutableUsername: true,
        minUsernameLength: 3,
        maxUsernameLength: 32,
        usernameValidator: (value) => usernameSchema.safeParse(value).success,
      }),
      twoFactor({
        issuer: "GradeShelf",
        backupCodeOptions: { storeBackupCodes: "encrypted" },
        twoFactorCookieMaxAge: 300,
      }),
    ],
    databaseHooks: {
      session: {
        create: {
          before: async (session, context) => {
            // Use Better Auth's current transaction, including during password rotation.
            const adapter = context?.context.internalAdapter;
            const user = await adapter?.findUserById(session.userId);
            if (!adapter || !user || !("isActive" in user) || user.isActive !== true) {
              throw new APIError("UNAUTHORIZED", { message: "Anmeldung nicht möglich." });
            }
            if ("isUnusedDefaultAdmin" in user && user.isUnusedDefaultAdmin === true) {
              await adapter.updateUser(session.userId, { isUnusedDefaultAdmin: false });
            }
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/" && !ctx.request && !ctx.headers) {
          return;
        }
        // Server-only endpoints have no public path; the HTTP handler also uses this allowlist.
        if (ctx.path && !exposedAuthPaths.has(ctx.path)) {
          throw new APIError("NOT_FOUND");
        }
        if (ctx.path && Object.hasOwn(authBodies, ctx.path)) {
          const schema = authBodies[ctx.path as keyof typeof authBodies];
          const parsed = schema.safeParse(ctx.body);
          if (!parsed.success) {
            throw new APIError("BAD_REQUEST", {
              code: "INVALID_INPUT",
              message: "Bitte prüfe deine Eingaben.",
            });
          }
          ctx.body = parsed.data;
        }
        if (ctx.path === "/sign-in/username") {
          return { context: { ...ctx, body: ctx.body } };
        }
        const session = await getSessionFromCtx(ctx, {
          disableCookieCache: true,
          disableRefresh: true,
        });
        if (session && ctx.path !== "/sign-out") {
          const user = await db.user.findUnique({ where: { id: session.user.id } });
          if (!user?.isActive) {
            throw new APIError("UNAUTHORIZED", { message: "Anmeldung nicht möglich." });
          }
          if (
            user.mustChangePassword &&
            ctx.path !== "/change-password" &&
            ctx.path !== "/get-session"
          ) {
            throw new APIError("FORBIDDEN", {
              code: "PASSWORD_CHANGE_REQUIRED",
              message: "Bitte ändere zuerst dein Passwort.",
            });
          }
          if (ctx.path === "/update-user" && ctx.body.name === "") {
            ctx.body.name = user.username ?? "GradeShelf";
          }
        }
        if (ctx.path === "/change-password") {
          ctx.body.revokeOtherSessions = true;
        }
        return { context: { ...ctx, body: ctx.body } };
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (isAPIError(ctx.context.returned)) {
          return;
        }
        const session = ctx.context.newSession ?? ctx.context.session;
        if (!session) {
          return;
        }
        if (ctx.path === "/change-password") {
          await db.user.update({
            where: { id: session.user.id },
            data: { mustChangePassword: false },
          });
          logEvent("auth.password_changed");
        }
        if (ctx.path === "/update-user") {
          logEvent("auth.display_name_changed");
        }
        const enrollmentVerified =
          ctx.path === "/two-factor/verify-totp" &&
          ctx.context.session &&
          !ctx.context.session.user.twoFactorEnabled;
        if (
          enrollmentVerified ||
          ctx.path === "/two-factor/disable" ||
          ctx.path === "/two-factor/generate-backup-codes"
        ) {
          await db.session.deleteMany({
            where: { userId: session.user.id, id: { not: session.session.id } },
          });
          logEvent("auth.two_factor_changed");
        }
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
