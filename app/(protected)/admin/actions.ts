"use server";

import { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { saveImprint } from "@/lib/admin/imprint";
import { saveInstanceName } from "@/lib/admin/instance";
import { saveAdminContact } from "@/lib/admin/contact";
import { AdminError } from "@/lib/admin/service";
import { logEvent } from "@/lib/logger.mjs";
import type { MessageKey } from "@/lib/i18n/messages";

function settingsError(error: unknown, invalidMessage: MessageKey, event: string): MessageKey {
  if (error instanceof ZodError) {
    return invalidMessage;
  }
  if (error instanceof AdminError) {
    if (error.code === "UNAUTHENTICATED") {
      return "gradeSignIn";
    }
    if (error.code === "PASSWORD_CHANGE_REQUIRED") {
      return "passwordRequired";
    }
    return "gradeForbidden";
  }
  logEvent(event, "error");
  return "serviceUnavailable";
}

export async function updateImprint(input: unknown): Promise<{ error: MessageKey | null }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "gradeSignIn" };
    }
    await saveImprint(await getDb(), user.id, input);
  } catch (error) {
    return { error: settingsError(error, "imprintInvalid", "admin.imprint_failed") };
  }

  revalidatePath("/", "layout");
  return { error: null };
}

export async function updateAdminContact(input: unknown): Promise<{ error: MessageKey | null }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "gradeSignIn" };
    }
    await saveAdminContact(await getDb(), user.id, input);
  } catch (error) {
    return { error: settingsError(error, "adminContactInvalid", "admin.contact_failed") };
  }

  revalidatePath("/login");
  revalidatePath("/admin");
  return { error: null };
}

export async function updateInstanceName(input: unknown): Promise<{ error: MessageKey | null }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "gradeSignIn" };
    }
    await saveInstanceName(await getDb(), user.id, input);
  } catch (error) {
    return { error: settingsError(error, "instanceNameInvalid", "admin.instance_name_failed") };
  }
  revalidatePath("/", "layout");
  return { error: null };
}
