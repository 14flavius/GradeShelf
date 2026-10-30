import type { PrismaClient } from "../../generated/prisma/client.ts";
import { createAuth } from "./core.ts";
import { loadSsoConfiguration, SsoError } from "./sso.ts";
import { ssoProviderId } from "./sso-validation.ts";

export async function createSsoAuth(db: PrismaClient) {
  const config = await loadSsoConfiguration(db);
  const auth = createAuth(db, config);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // The library also performs discovery during initialization. Keep a stalled
    // provider off the local authentication path, and bound SSO initialization.
    const context = await Promise.race([
      auth.$context,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SsoError("UNAVAILABLE")), 5000);
      }),
    ]);
    const provider = context.socialProviders.find((candidate) => candidate.id === ssoProviderId);
    if (!provider?.idToken || !provider.requiresIdTokenNonce || provider.issuer !== config.issuer) {
      throw new SsoError("DISCOVERY");
    }
    return auth;
  } finally {
    clearTimeout(timer);
  }
}
