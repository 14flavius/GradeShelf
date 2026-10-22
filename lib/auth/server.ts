import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { accessRedirect, readCurrentUser } from "./access";
import { getDb } from "@/lib/db";
import { createAuth, type Auth } from "./core";

let authPromise: Promise<Auth> | undefined;

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
