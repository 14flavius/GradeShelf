import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { accessRedirect, readCurrentUser } from "./access";
import { getDb } from "@/lib/db";
import { createAuth, type Auth } from "./core";
import { createSsoAuth } from "./sso-runtime";
import { SsoError } from "./sso";

let authPromise: Promise<Auth> | undefined;
let ssoCache: { revision: number; promise: Promise<Auth> } | undefined;

// Local authentication never initializes an external provider. Read the revision
// on each SSO request so changes take effect across server module instances.
export async function getSsoAuth() {
  const db = await getDb();
  const settings = await db.ssoSettings.findUnique({
    where: { id: 1 },
    select: { enabled: true, revision: true },
  });
  if (!settings?.enabled) {
    throw new SsoError("UNAVAILABLE");
  }
  if (ssoCache?.revision === settings.revision) {
    return ssoCache.promise;
  }
  const entry = { revision: settings.revision, promise: createSsoAuth(db) };
  ssoCache = entry;
  entry.promise.catch(() => {
    if (ssoCache === entry) {
      ssoCache = undefined;
    }
  });
  return entry.promise;
}

export function getAuth() {
  authPromise ??= getDb()
    .then(createAuth)
    .catch((error: unknown) => {
      authPromise = undefined;
      throw error;
    });
  return authPromise;
}

export async function getCurrentUser() {
  const requestHeaders = await headers();
  const auth = await getAuth();
  const db = await getDb();
  return readCurrentUser(db, auth, requestHeaders);
}

export async function requireUser(
  options: { allowPasswordChange?: boolean; admin?: boolean } = {},
) {
  const user = await getCurrentUser();
  const destination = accessRedirect(user, options);
  if (destination) {
    redirect(destination);
  }
  if (!user) {
    redirect("/login");
  }
  return user;
}
