import { z } from "zod";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import type { PrismaClient } from "../../generated/prisma/client.ts";
import { assertAdmin } from "../admin/service.ts";
import { getAuthEnvironment } from "./environment.ts";
import { logEvent } from "../logger.mjs";
import { readRequestBody } from "../request-body.ts";
import { ssoSettingsSchema, ssoUrlSchema, type SsoSettingsView } from "./sso-validation.ts";

export class SsoError extends Error {
  readonly code: "INVALID" | "DISCOVERY" | "CONFLICT" | "SECRET_REQUIRED" | "UNAVAILABLE";
  constructor(code: SsoError["code"]) {
    super(code);
    this.code = code;
  }
}

const discoverySchema = z.object({
  issuer: ssoUrlSchema,
  authorization_endpoint: ssoUrlSchema,
  token_endpoint: ssoUrlSchema,
  jwks_uri: ssoUrlSchema,
  userinfo_endpoint: ssoUrlSchema.optional(),
  id_token_signing_alg_values_supported: z.array(z.string()).min(1),
  response_types_supported: z.array(z.string()),
  code_challenge_methods_supported: z.array(z.string()).optional(),
  token_endpoint_auth_methods_supported: z.array(z.string()).optional(),
});

export async function fetchSsoJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new SsoError("DISCOVERY");
  }
  const bytes = await readRequestBody(response, 256 * 1024);
  if (bytes === null) {
    throw new SsoError("DISCOVERY");
  }
  return JSON.parse(bytes.toString("utf8")) as unknown;
}

export async function discoverSso(issuer: string) {
  try {
    const data = discoverySchema.parse(
      await fetchSsoJson(`${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`),
    );
    const methods = data.token_endpoint_auth_methods_supported ?? ["client_secret_basic"];
    if (
      data.issuer !== issuer ||
      !data.response_types_supported.includes("code") ||
      data.id_token_signing_alg_values_supported.includes("none") ||
      (data.code_challenge_methods_supported &&
        !data.code_challenge_methods_supported.includes("S256")) ||
      !methods.some((method) => ["client_secret_basic", "client_secret_post"].includes(method))
    ) {
      throw new SsoError("DISCOVERY");
    }
    return {
      ...data,
      authentication: methods.includes("client_secret_basic")
        ? ("basic" as const)
        : ("post" as const),
    };
  } catch {
    throw new SsoError("DISCOVERY");
  }
}

export async function readSsoSettings(db: PrismaClient): Promise<SsoSettingsView> {
  const row = await db.ssoSettings.findUnique({ where: { id: 1 } });
  return {
    enabled: row?.enabled ?? false,
    issuer: row?.issuer ?? "",
    clientId: row?.clientId ?? "",
    hasClientSecret: Boolean(row?.encryptedClientSecret),
    revision: row?.revision ?? 0,
    callbackUrl: `${getAuthEnvironment().baseURL}/api/auth/callback/oidc`,
  };
}

export async function checkSsoSettings(db: PrismaClient, actorId: string, input: unknown) {
  await assertAdmin(db, actorId);
  const parsed = ssoSettingsSchema.safeParse(input);
  if (!parsed.success) {
    throw new SsoError("INVALID");
  }
  const current = await db.ssoSettings.findUnique({ where: { id: 1 } });
  if ((current?.revision ?? 0) !== parsed.data.revision) {
    throw new SsoError("CONFLICT");
  }
  await discoverSso(parsed.data.issuer);
}

export async function saveSsoSettings(db: PrismaClient, actorId: string, input: unknown) {
  await assertAdmin(db, actorId);
  const parsed = ssoSettingsSchema.safeParse(input);
  if (!parsed.success) {
    throw new SsoError("INVALID");
  }
  const data = parsed.data;
  const current = await db.ssoSettings.findUnique({ where: { id: 1 } });
  if ((current?.revision ?? 0) !== data.revision) {
    throw new SsoError("CONFLICT");
  }
  const identityChanged = current?.issuer !== data.issuer || current?.clientId !== data.clientId;
  if (!data.clientSecret && (!current?.encryptedClientSecret || identityChanged)) {
    throw new SsoError("SECRET_REQUIRED");
  }
  // Disabling an unavailable provider must never require contacting it.
  if (data.enabled) {
    await discoverSso(data.issuer);
  }
  const encryptedClientSecret = data.clientSecret
    ? await symmetricEncrypt({ key: getAuthEnvironment().secret, data: data.clientSecret })
    : current?.encryptedClientSecret;
  if (!encryptedClientSecret) {
    throw new SsoError("SECRET_REQUIRED");
  }
  await db.$transaction(async (tx) => {
    await assertAdmin(tx, actorId);
    const latest = await tx.ssoSettings.findUnique({ where: { id: 1 } });
    if ((latest?.revision ?? 0) !== data.revision) {
      throw new SsoError("CONFLICT");
    }
    const settings = {
      enabled: data.enabled,
      issuer: data.issuer,
      clientId: data.clientId,
      encryptedClientSecret,
      revision: data.revision + 1,
    };
    await tx.ssoSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...settings },
      update: settings,
    });
    await tx.session.deleteMany({ where: { ssoAccountId: { not: null } } });
  });
  logEvent("admin.sso_updated");
  return readSsoSettings(db);
}

export async function loadSsoConfiguration(db: PrismaClient) {
  const row = await db.ssoSettings.findUnique({ where: { id: 1 } });
  if (!row?.enabled) {
    throw new SsoError("UNAVAILABLE");
  }
  const clientSecret = await symmetricDecrypt({
    key: getAuthEnvironment().secret,
    data: row.encryptedClientSecret,
  });
  const discovery = await discoverSso(row.issuer);
  return {
    issuer: row.issuer,
    clientId: row.clientId,
    revision: row.revision,
    clientSecret,
    discovery,
  };
}

export type SsoConfiguration = Awaited<ReturnType<typeof loadSsoConfiguration>>;
