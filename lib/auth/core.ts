import { getAuthEnvironment } from "./environment.ts";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
  addOAuthServerContext,
  getOAuthState,
} from "better-auth/api";
import { twoFactor, username } from "better-auth/plugins";
import type { PrismaClient } from "@/generated/prisma/client";
import { logEvent } from "../logger.mjs";
import { authBodies, exposedAuthPaths, usernameSchema } from "./validation.ts";
import { entryReturnPath } from "./return-path.ts";
import { hasFreshLocalSession, ssoAccountKey, ssoProviderId } from "./sso-validation.ts";
import type { SsoConfiguration } from "./sso.ts";
import { ssoProvider } from "./sso-provider.ts";

const discardedSsoTokens = {
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  scope: null,
};

export function createAuth(db: PrismaClient, sso?: SsoConfiguration) {
  const environment = getAuthEnvironment();
  return betterAuth({
    appName: "GradeShelf",
    ...environment,
    database: prismaAdapter(db, { provider: "sqlite", transaction: true }),
    trustedOrigins: [environment.baseURL],
    telemetry: { enabled: false },
    logger: { level: "error", log: () => logEvent("auth.internal_error", "error") },
    onAPIError: {
      errorURL: `${environment.baseURL}/login?sso=error`,
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
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      cookieCache: { enabled: false },
      additionalFields: {
        ssoAccountId: { type: "string", required: false, input: false },
        ssoRevision: { type: "number", required: false, input: false },
      },
    },
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        allowDifferentEmails: true,
        trustedProviders: sso ? [ssoProviderId] : [],
      },
    },
    user: {
      validateUserInfo: async ({ user, source }, ctx) => {
        if (source.method !== "oauth") {
          return;
        }
        if (!sso || source.oauth?.providerId !== ssoProviderId || source.action === "create-user") {
          return { error: "SSO_NOT_LINKED" };
        }
        const state = await getOAuthState();
        const settings = await db.ssoSettings.findUnique({ where: { id: 1 } });
        if (
          !settings?.enabled ||
          settings.revision !== sso.revision ||
          state?.serverContext?.ssoRevision !== sso.revision
        ) {
          return { error: "SSO_CONFIGURATION_CHANGED" };
        }
        const owner =
          typeof user.id === "string"
            ? await db.user.findFirst({
                where: { id: user.id, isActive: true, mustChangePassword: false },
              })
            : null;
        if (!owner) {
          return { error: "SSO_NOT_AVAILABLE" };
        }
        if (source.action === "link-account") {
          const session = await getSessionFromCtx(ctx, {
            disableCookieCache: true,
            disableRefresh: true,
          });
          if (
            !session ||
            session.user.id !== owner.id ||
            session.session.id !== state?.serverContext?.ssoSessionId ||
            !hasFreshLocalSession(session.session)
          ) {
            return { error: "SSO_REAUTH_REQUIRED" };
          }
          if (
            await db.account.findFirst({ where: { userId: owner.id, providerId: ssoProviderId } })
          ) {
            return { error: "SSO_ALREADY_LINKED" };
          }
        } else {
          const subject = source.oauth.profile?.sub;
          const account =
            typeof subject === "string"
              ? await db.account.findFirst({
                  where: {
                    userId: owner.id,
                    providerId: ssoProviderId,
                    accountId: ssoAccountKey(sso.issuer, sso.clientId, subject),
                  },
                  select: { id: true },
                })
              : null;
          if (!account || !state?.serverContext) {
            return { error: "SSO_NOT_LINKED" };
          }
          // Request-local proof from the verified profile, never client input.
          // The session hook binds the session to this exact account row.
          state.serverContext.verifiedSsoAccountId = account.id;
        }
      },
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
        "/sign-in/social": { window: 60, max: 10 },
        "/link-social": { window: 60, max: 5 },
        "/unlink-account": { window: 60, max: 5 },
      },
    },
    plugins: [
      ...(sso ? [ssoProvider(sso)] : []),
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
      account: {
        create: {
          before: async (account) =>
            account.providerId === ssoProviderId
              ? { data: { ...account, ...discardedSsoTokens } }
              : undefined,
        },
        update: {
          before: async (account) =>
            account.providerId === ssoProviderId
              ? { data: { ...account, ...discardedSsoTokens } }
              : undefined,
        },
        delete: {
          after: async (account) => {
            if (account.providerId === ssoProviderId) {
              // The foreign key deletes associated SSO sessions atomically.
              logEvent("auth.sso_unlinked");
            }
          },
        },
      },
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
            if (context?.path === "/callback/:id" || context?.path === "/callback/oidc") {
              const settings = await db.ssoSettings.findUnique({ where: { id: 1 } });
              const accountId = (await getOAuthState())?.serverContext?.verifiedSsoAccountId;
              if (
                !sso ||
                !settings?.enabled ||
                settings.revision !== sso.revision ||
                !("mustChangePassword" in user) ||
                user.mustChangePassword ||
                typeof accountId !== "string"
              ) {
                throw new APIError("UNAUTHORIZED", { code: "SSO_NOT_AVAILABLE" });
              }
              const account = await db.account.findFirst({
                where: {
                  id: accountId,
                  userId: session.userId,
                  providerId: ssoProviderId,
                },
              });
              if (!account) {
                throw new APIError("UNAUTHORIZED", { code: "SSO_NOT_AVAILABLE" });
              }
              return { data: { ...session, ssoAccountId: account.id, ssoRevision: sso.revision } };
            }
            const previous = context?.context.session?.session;
            if (
              previous?.userId === session.userId &&
              (context?.path === "/change-password" || context?.path?.startsWith("/two-factor/"))
            ) {
              // Rotating a session is not a fresh local login. Preserve its
              // source and authentication age when passwords or 2FA change.
              return {
                data: {
                  ...session,
                  createdAt: previous.createdAt,
                  ssoAccountId:
                    typeof previous.ssoAccountId === "string" ? previous.ssoAccountId : null,
                  ssoRevision:
                    typeof previous.ssoRevision === "number" ? previous.ssoRevision : null,
                },
              };
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
        const callback = ctx.path === "/callback/:id" && ctx.params?.id === ssoProviderId;
        if (ctx.path && !exposedAuthPaths.has(ctx.path) && !callback) {
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
        if (ctx.path === "/sign-in/social" || ctx.path === "/link-social" || callback) {
          if (!sso) {
            throw new APIError("NOT_FOUND");
          }
          const settings = await db.ssoSettings.findUnique({ where: { id: 1 } });
          if (!settings?.enabled || settings.revision !== sso.revision) {
            throw new APIError("FORBIDDEN", { code: "SSO_CONFIGURATION_CHANGED" });
          }
        }
        const session = await getSessionFromCtx(ctx, {
          disableCookieCache: true,
          disableRefresh: true,
        });
        if (session && ctx.path !== "/sign-out") {
          if (session.session.ssoAccountId) {
            const settings = await db.ssoSettings.findUnique({ where: { id: 1 } });
            if (!settings?.enabled || settings.revision !== session.session.ssoRevision) {
              throw new APIError("UNAUTHORIZED", { code: "SSO_NOT_AVAILABLE" });
            }
          }
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
        if (ctx.path === "/link-social" || ctx.path === "/unlink-account") {
          if (!session || !hasFreshLocalSession(session.session)) {
            throw new APIError("FORBIDDEN", { code: "SSO_REAUTH_REQUIRED" });
          }
          if (ctx.path === "/unlink-account") {
            const account = await db.account.findFirst({
              where: { id: ctx.body.accountId, userId: session.user.id, providerId: ssoProviderId },
            });
            if (!account) {
              throw new APIError("NOT_FOUND");
            }
          } else {
            if (
              await db.account.findFirst({
                where: { userId: session.user.id, providerId: ssoProviderId },
              })
            ) {
              throw new APIError("CONFLICT", { code: "SSO_ALREADY_LINKED" });
            }
            ctx.body.callbackURL = "/settings?sso=linked#sso-settings";
            ctx.body.errorCallbackURL = "/settings?sso=error#sso-settings";
            await addOAuthServerContext({ ssoSessionId: session.session.id });
          }
        }
        if (ctx.path === "/sign-in/social") {
          ctx.body.callbackURL = entryReturnPath(ctx.body.callbackURL);
          ctx.body.errorCallbackURL = "/login?sso=error";
        }
        if (ctx.path === "/sign-in/social" || ctx.path === "/link-social") {
          await addOAuthServerContext({ ssoRevision: sso?.revision });
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
