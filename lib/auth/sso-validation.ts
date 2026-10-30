import { z } from "zod";
import type { MessageKey } from "../i18n/messages.ts";

export const ssoProviderId = "oidc";
export const ssoSettingsPath = "/settings#sso-settings";
export const ssoReauthPath = "/login?reauth=sso&returnTo=%2Fsettings%23sso-settings";

// HTTP is only useful for a loopback test provider during local development.
export const ssoUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .pipe(z.url())
  .refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.hash &&
      (url.protocol === "https:" ||
        (process.env.NODE_ENV !== "production" &&
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    );
  });

export const ssoSettingsSchema = z
  .object({
    enabled: z.boolean(),
    issuer: ssoUrlSchema.refine((value) => !new URL(value).search),
    clientId: z
      .string()
      .trim()
      .min(1)
      .max(256)
      .regex(/^[^\u0000-\u001f\u007f]+$/),
    clientSecret: z.string().max(4096).optional(),
    revision: z.number().int().nonnegative(),
  })
  .strict();

export type SsoSettingsView = {
  enabled: boolean;
  issuer: string;
  clientId: string;
  hasClientSecret: boolean;
  revision: number;
  callbackUrl: string;
};

export function hasFreshLocalSession(session: {
  createdAt: Date | string;
  ssoAccountId?: unknown;
}) {
  const age = Date.now() - new Date(session.createdAt).getTime();
  return session.ssoAccountId == null && age >= 0 && age < 5 * 60 * 1000;
}

// Client IDs can have different subject namespaces even at the same issuer.
export function ssoAccountKey(issuer: string, clientId: string, subject: string) {
  return JSON.stringify([issuer, clientId, subject]);
}

export function ssoResultMessage(status: unknown): MessageKey | undefined {
  if (status === "error") {
    return "ssoFailed";
  }
  if (status === "reauth") {
    return "ssoReauthRequired";
  }
  if (status === "unlinked") {
    return "ssoNotLinked";
  }
  return undefined;
}
