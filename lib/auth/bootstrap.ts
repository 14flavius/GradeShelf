import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.ts";
import { passwordSchema, usernameSchema } from "./validation.ts";
import { logEvent } from "../logger.mjs";

export class BootstrapInputError extends Error {}

async function newAdminData(input: {
  username: string;
  password: string;
}): Promise<Prisma.UserCreateInput> {
  const username = usernameSchema.parse(input.username);
  const password = await hashPassword(passwordSchema.parse(input.password));
  const id = randomUUID();
  return {
    id,
    username,
    name: username,
    email: `${id}@accounts.gradeshelf.invalid`,
    role: "ADMIN",
    mustChangePassword: true,
    accounts: { create: { accountId: id, providerId: "credential", password } },
  };
}

export async function createAdmin(db: PrismaClient, input: { username: string; password: string }) {
  const data = await newAdminData(input);
  try {
    const removed = await db.$transaction(async (tx) => {
      await tx.user.create({ data });
      return removeUnusedDefaultAdmin(tx);
    });
    if (removed) {
      logEvent("admin.unused_default_removed");
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new BootstrapInputError(
        "Dieser Benutzername ist bereits vergeben. Bitte wähle einen anderen.",
      );
    }
    throw error;
  }
  logEvent("admin.cli_created");
}

export async function ensureDefaultAdmin(db: PrismaClient) {
  if (await db.bootstrapState.findUnique({ where: { id: 1 } })) {
    if (await db.$transaction(removeUnusedDefaultAdmin)) {
      logEvent("admin.unused_default_removed");
    }
    return;
  }
  const data = await newAdminData({ username: "gradeshelf", password: "gradeshelf0000" });
  try {
    const created = await db.$transaction(async (tx) => {
      // Persist the decision even on existing installations, so deleting users never recreates this account.
      await tx.bootstrapState.create({ data: { id: 1 } });
      if (await tx.user.count()) {
        return false;
      }
      await tx.user.create({ data: { ...data, isUnusedDefaultAdmin: true } });
      return true;
    });
    if (created) {
      logEvent("admin.default_created");
    }
  } catch (error) {
    // Another startup may have completed initialization while the password was being hashed.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      (await db.bootstrapState.findUnique({ where: { id: 1 } }))
    ) {
      return;
    }
    throw error;
  }
}

// Call inside the same transaction as the replacement admin's creation/activation.
export async function removeUnusedDefaultAdmin(tx: Prisma.TransactionClient) {
  const replacement = await tx.user.findFirst({
    where: {
      role: "ADMIN",
      isActive: true,
      isUnusedDefaultAdmin: false,
      accounts: { some: { providerId: "credential", password: { not: null } } },
    },
    select: { id: true },
  });
  if (!replacement) {
    return false;
  }
  const removed = await tx.user.deleteMany({
    where: {
      isUnusedDefaultAdmin: true,
      role: "ADMIN",
      mustChangePassword: true,
      twoFactorEnabled: false,
      twoFactor: { is: null },
      sessions: { none: {} },
      gradeLists: { none: {} },
      subjects: { none: {} },
      gradeTypes: { none: {} },
      gradeEntries: { none: {} },
      attachments: { none: {} },
      dashboardPreferences: { none: {} },
    },
  });
  return removed.count > 0;
}
