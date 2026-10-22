import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.ts";
import { adminCommandSchema, type AdminUserView } from "./commands.ts";
import { cleanupFiles, ensureStorageReady } from "../attachments/storage.ts";
import { logEvent } from "../logger.mjs";
import { removeUnusedDefaultAdmin } from "../auth/bootstrap.ts";

type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "PASSWORD_CHANGE_REQUIRED"
  | "NOT_FOUND"
  | "SELF_ACTION"
  | "LAST_ADMIN"
  | "USERNAME_TAKEN"
  | "CONFIRMATION_REQUIRED";

export class AdminError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(code);
    this.code = code;
  }
}

export async function assertAdmin(db: Prisma.TransactionClient, actorId: string) {
  const actor = await db.user.findFirst({
    where: { id: actorId, isActive: true },
    select: { role: true, mustChangePassword: true },
  });
  if (!actor) {
    throw new AdminError("UNAUTHENTICATED");
  }
  if (actor.mustChangePassword) {
    throw new AdminError("PASSWORD_CHANGE_REQUIRED");
  }
  if (actor.role !== "ADMIN") {
    throw new AdminError("FORBIDDEN");
  }
}

export async function listAdminUsers(db: PrismaClient, actorId: string): Promise<AdminUserView[]> {
  return db.$transaction(async (tx) => {
    await assertAdmin(tx, actorId);
    const users = await tx.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
        mustChangePassword: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }));
  });
}

// Better Auth 1.7 stores pending 2FA challenges (and trusted devices) with
// value=userId; attempt records are keyed by the challenge identifier.
async function revokeAuthentication(tx: Prisma.TransactionClient, userId: string) {
  await tx.session.deleteMany({ where: { userId } });
  const challenges = await tx.verification.findMany({
    where: { value: userId },
    select: { identifier: true },
  });
  for (const challenge of challenges) {
    await tx.verification.deleteMany({
      where: { identifier: `2fa-attempts-${challenge.identifier}` },
    });
  }
  await tx.verification.deleteMany({ where: { value: userId } });
}

export async function applyAdminCommand(db: PrismaClient, actorId: string, input: unknown) {
  await assertAdmin(db, actorId);
  const command = adminCommandSchema.parse(input);
  // Expensive password hashing stays outside SQLite's write transaction.
  const password = "password" in command ? await hashPassword(command.password) : undefined;
  if (command.action === "delete") {
    await ensureStorageReady(db);
  }
  let removedDefaultAdmin = false;
  try {
    const result = await db.$transaction(async (tx) => {
      await assertAdmin(tx, actorId);
      if (command.action === "create") {
        const id = randomUUID();
        await tx.user.create({
          data: {
            id,
            username: command.username,
            name: command.username,
            role: command.role,
            email: `${id}@accounts.gradeshelf.invalid`,
            locale: "en",
            mustChangePassword: command.mustChangePassword,
            accounts: { create: { providerId: "credential", accountId: id, password } },
          },
        });
        if (command.role === "ADMIN") {
          removedDefaultAdmin = await removeUnusedDefaultAdmin(tx);
        }
        return { id };
      }
      if (command.id === actorId && command.action !== "setUsername") {
        throw new AdminError("SELF_ACTION");
      }
      const target = await tx.user.findUnique({
        where: { id: command.id },
        select: { id: true, username: true, name: true, role: true, isActive: true },
      });
      if (!target) {
        throw new AdminError("NOT_FOUND");
      }
      if (command.action === "setUsername" && command.username === target.username) {
        return { id: target.id };
      }
      if (
        (command.action === "delete" || (command.action === "setActive" && !command.active)) &&
        target.role === "ADMIN" &&
        target.isActive &&
        (await tx.user.count({
          where: { role: "ADMIN", isActive: true, id: { not: target.id } },
        })) === 0
      ) {
        throw new AdminError("LAST_ADMIN");
      }
      if (command.action === "delete" && command.confirmation !== (target.username ?? target.id)) {
        throw new AdminError("CONFIRMATION_REQUIRED");
      }
      // Re-enabling also invalidates any stale authentication left from an older state.
      await revokeAuthentication(tx, target.id);
      switch (command.action) {
        case "setActive":
          await tx.user.update({ where: { id: target.id }, data: { isActive: command.active } });
          if (command.active && target.role === "ADMIN") {
            removedDefaultAdmin = await removeUnusedDefaultAdmin(tx);
          }
          break;
        case "setUsername":
          await tx.user.update({
            where: { id: target.id },
            data: {
              username: command.username,
              isUnusedDefaultAdmin: false,
              ...(target.name === target.username ? { name: command.username } : {}),
            },
          });
          break;
        case "setPassword":
          await tx.account.upsert({
            where: {
              providerId_accountId: { providerId: "credential", accountId: target.id },
              userId: target.id,
            },
            create: { userId: target.id, accountId: target.id, providerId: "credential", password },
            update: { password },
          });
          await tx.user.update({
            where: { id: target.id },
            data: { mustChangePassword: true, isUnusedDefaultAdmin: false },
          });
          break;
        case "forcePasswordChange":
          await tx.user.update({ where: { id: target.id }, data: { mustChangePassword: true } });
          break;
        case "resetTwoFactor":
          await tx.twoFactor.deleteMany({ where: { userId: target.id } });
          await tx.user.update({ where: { id: target.id }, data: { twoFactorEnabled: false } });
          break;
        case "delete": {
          const files = await tx.attachment.findMany({
            where: { userId: target.id },
            select: { storageName: true },
          });
          for (const file of files) {
            await tx.fileCleanup.create({
              data: { storageName: file.storageName, kind: "DELETE" },
            });
          }
          await tx.attachment.deleteMany({ where: { userId: target.id } });
          await tx.gradeEntry.deleteMany({ where: { userId: target.id } });
          await tx.subject.deleteMany({ where: { userId: target.id } });
          await tx.dashboardPreference.deleteMany({ where: { userId: target.id } });
          await tx.gradeList.deleteMany({ where: { userId: target.id } });
          await tx.gradeType.deleteMany({ where: { userId: target.id } });
          await tx.user.delete({ where: { id: target.id } });
          break;
        }
      }
      return { id: target.id };
    });
    const events = {
      create: "admin.user_created",
      setActive:
        command.action === "setActive" && command.active
          ? "admin.user_enabled"
          : "admin.user_disabled",
      setUsername: "admin.username_changed",
      setPassword: "admin.password_reset",
      forcePasswordChange: "admin.password_change_required",
      resetTwoFactor: "admin.two_factor_reset",
      delete: "admin.user_deleted",
    };
    logEvent(events[command.action]);
    if (removedDefaultAdmin) {
      logEvent("admin.unused_default_removed");
    }
    if (command.action === "delete") {
      await cleanupFiles(db);
    }
    return result;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      (command.action === "create" || command.action === "setUsername")
    ) {
      throw new AdminError("USERNAME_TAKEN");
    }
    throw error;
  }
}
