import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { getCurrentUser } from "../auth/server";
import { browserLocale } from "./config";
import { messages } from "./messages";

export const getRequestLocale = cache(async () => {
  const user = await getCurrentUser();
  return user?.locale ?? browserLocale(await headers());
});

export async function getRequestMessages() {
  return messages[await getRequestLocale()];
}
