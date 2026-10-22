import { ensureStorageReady, cleanupFiles } from "../attachments/storage.ts";
import { queueEntryFiles } from "../attachments/service.ts";
import { z } from "zod";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.ts";
import { gradeCommandSchema } from "./commands.ts";
import { gradeEntryInputSchema, normalizedGradeName } from "./validation.ts";
import { logEvent } from "../logger.mjs";

type ValidatedGradeCommand = z.output<typeof gradeCommandSchema>;

type MutationErrorCode =
  | "NOT_FOUND"
  | "IN_USE"
  | "SCALE_LOCKED"
  | "ARCHIVED"
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "PASSWORD_CHANGE_REQUIRED"
  | "TYPE_NAME_EXISTS";

export class GradeMutationError extends Error {
  readonly code: MutationErrorCode;
  constructor(code: MutationErrorCode) {
    super(code);
    this.code = code;
  }
}

async function ownedList(tx: Prisma.TransactionClient, userId: string, id: string) {
  const list = await tx.gradeList.findFirst({ where: { id, userId } });
  if (!list) {
    throw new GradeMutationError("NOT_FOUND");
  }
  if (list.status !== "ACTIVE") {
    throw new GradeMutationError("ARCHIVED");
  }
  return list;
}

async function assertOwnedTypes(tx: Prisma.TransactionClient, userId: string, ids: string[]) {
  if ((await tx.gradeType.count({ where: { userId, id: { in: ids } } })) !== ids.length) {
    throw new GradeMutationError("NOT_FOUND");
  }
}

async function createSetup(
  tx: Prisma.TransactionClient,
  userId: string,
  command: Extract<ValidatedGradeCommand, { action: "setup.create" }>,
) {
  const id = `setup_${command.data.requestId}`;
  const existing = await tx.gradeList.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (existing) {
    return existing;
  }
  await assertOwnedTypes(tx, userId, command.data.existingTypeIds);
  const available = await tx.gradeType.findMany({
    where: { userId },
    select: { id: true, name: true, weight: true },
  });
  const typeIds = new Set(command.data.existingTypeIds);
  for (const type of command.data.types) {
    const matches = available.filter(
      (item) => normalizedGradeName(item.name) === normalizedGradeName(type.name),
    );
    const reusable = matches.find((item) => item.weight === type.weight);
    if (matches.length && !reusable) {
      throw new GradeMutationError("TYPE_NAME_EXISTS");
    }
    const saved = reusable ?? (await tx.gradeType.create({ data: { ...type, userId } }));
    typeIds.add(saved.id);
  }
  const list = await tx.gradeList.create({
    data: { ...command.data.list, id, userId, useAllGradeTypes: false },
  });
  await tx.subject.createMany({
    data: command.data.subjects.map((subject) => ({
      ...subject,
      userId,
      gradeListId: list.id,
    })),
  });
  await tx.gradeListType.createMany({
    data: [...typeIds].map((gradeTypeId) => ({ gradeTypeId, gradeListId: id, userId })),
  });
  await tx.dashboardPreference.create({
    data: { ...command.data.preferences, gradeListId: list.id, userId },
  });
  return { id: list.id };
}

async function saveEntry(
  tx: Prisma.TransactionClient,
  userId: string,
  command: Extract<ValidatedGradeCommand, { action: "entry.create" | "entry.update" }>,
) {
  const { gradeListId } = z.object({ gradeListId: z.string().min(1).max(128) }).parse(command.data);
  const list = await ownedList(tx, userId, gradeListId);
  const existing =
    command.action === "entry.update"
      ? await tx.gradeEntry.findFirst({ where: { id: command.id, userId } })
      : null;
  if (command.action === "entry.update" && !existing) {
    throw new GradeMutationError("NOT_FOUND");
  }
  // Moving a grade to another scale would reinterpret it. Edit within its list.
  if (existing && existing.gradeListId !== list.id) {
    throw new GradeMutationError("INVALID_INPUT");
  }
  const data = gradeEntryInputSchema(list.gradingSystemId, existing?.grade).parse(command.data);
  const subject = await tx.subject.findFirst({
    where: { id: data.subjectId, gradeListId: list.id, userId },
    select: { id: true },
  });
  const type = await tx.gradeType.findFirst({
    where: { id: data.gradeTypeId, userId },
    select: { id: true, weight: true },
  });
  if (!subject || !type) {
    throw new GradeMutationError("NOT_FOUND");
  }
  if (
    !list.useAllGradeTypes &&
    existing?.gradeTypeId !== type.id &&
    !(await tx.gradeListType.findFirst({
      where: { userId, gradeListId: list.id, gradeTypeId: type.id },
    }))
  ) {
    throw new GradeMutationError("INVALID_INPUT");
  }
  const weight = existing?.gradeTypeId === type.id ? existing.weight : type.weight;
  // Notes and corrections keep the recording order. Clearing then re-entering
  // a grade starts a new grading time, including when the grade is zero.
  const gradedAt =
    data.grade === null
      ? null
      : existing?.grade !== null && existing?.gradedAt
        ? existing.gradedAt
        : new Date();
  const saved = existing
    ? await tx.gradeEntry.update({
        where: { id: existing.id, userId },
        data: { ...data, weight, gradedAt },
      })
    : await tx.gradeEntry.create({ data: { ...data, weight, gradedAt, userId } });
  if (data.grade !== null && !list.gradingSystemLockedAt) {
    await tx.gradeList.update({
      where: { id: list.id, userId },
      data: { gradingSystemLockedAt: new Date() },
    });
  }
  return { id: saved.id };
}

export async function applyGradeMutation(db: PrismaClient, userId: string, input: unknown) {
  const command = gradeCommandSchema.parse(input);
  const deletesFiles =
    command.action === "entry.delete" ||
    command.action === "subject.delete" ||
    command.action === "list.delete";
  try {
    if (deletesFiles) {
      await ensureStorageReady(db);
    }
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, isActive: true },
        select: { mustChangePassword: true },
      });
      if (!user) {
        throw new GradeMutationError("UNAUTHENTICATED");
      }
      if (user.mustChangePassword) {
        throw new GradeMutationError("PASSWORD_CHANGE_REQUIRED");
      }
      switch (command.action) {
        case "setup.create":
          return createSetup(tx, userId, command);
        case "list.create": {
          const { preferences, ...data } = command.data;
          const list = await tx.gradeList.create({ data: { ...data, userId } });
          await tx.dashboardPreference.create({
            data: { gradeListId: list.id, userId, ...preferences },
          });
          return { id: list.id };
        }
        case "list.update": {
          const list = await ownedList(tx, userId, command.id);
          if (
            list.gradingSystemId !== command.data.gradingSystemId &&
            (list.gradingSystemLockedAt ||
              (await tx.gradeEntry.count({
                where: { gradeListId: list.id, userId, grade: { not: null } },
              })))
          ) {
            throw new GradeMutationError("SCALE_LOCKED");
          }
          const { preferences, ...data } = command.data;
          await tx.gradeList.update({ where: { id: list.id, userId }, data });
          if (preferences) {
            await tx.dashboardPreference.upsert({
              where: { gradeListId_userId: { gradeListId: list.id, userId } },
              create: { gradeListId: list.id, userId, ...preferences },
              update: preferences,
            });
          }
          return { id: list.id };
        }
        case "list.default": {
          await ownedList(tx, userId, command.id);
          if (command.enabled) {
            await tx.gradeList.updateMany({
              where: { userId, isDefault: true },
              data: { isDefault: false },
            });
          }
          await tx.gradeList.update({
            where: { id: command.id, userId },
            data: { isDefault: command.enabled },
          });
          return { id: command.id };
        }
        case "list.types": {
          await ownedList(tx, userId, command.id);
          await assertOwnedTypes(tx, userId, command.data.gradeTypeIds);
          await tx.gradeList.update({
            where: { id: command.id, userId },
            data: { useAllGradeTypes: command.data.useAllGradeTypes },
          });
          await tx.gradeListType.deleteMany({ where: { gradeListId: command.id, userId } });
          if (!command.data.useAllGradeTypes) {
            await tx.gradeListType.createMany({
              data: command.data.gradeTypeIds.map((gradeTypeId) => ({
                gradeTypeId,
                gradeListId: command.id,
                userId,
              })),
            });
          }
          return { id: command.id };
        }
        case "list.status": {
          const list = await tx.gradeList.findFirst({
            where: { id: command.id, userId },
            select: { id: true, status: true },
          });
          if (!list) {
            throw new GradeMutationError("NOT_FOUND");
          }
          // Repeated requests are idempotent: restoring an already active list
          // must not overwrite preferences selected after its restoration.
          if (list.status !== command.status) {
            await tx.gradeList.update({
              where: { id: list.id, userId },
              data: {
                status: command.status,
                ...(command.status === "ARCHIVED" ? { isDefault: false } : {}),
              },
            });
            await tx.dashboardPreference.upsert({
              where: { gradeListId_userId: { gradeListId: list.id, userId } },
              create: {
                gradeListId: list.id,
                userId,
                showOnDashboard: false,
                includeInOverall: false,
              },
              update: { showOnDashboard: false, includeInOverall: false },
            });
          }
          return { id: list.id };
        }
        case "list.preferences": {
          await ownedList(tx, userId, command.id);
          await tx.dashboardPreference.upsert({
            where: { gradeListId_userId: { gradeListId: command.id, userId } },
            create: { gradeListId: command.id, userId, ...command.data },
            update: command.data,
          });
          return { id: command.id };
        }
        case "list.delete": {
          await ownedList(tx, userId, command.id);
          const where = { gradeListId: command.id, userId };
          await queueEntryFiles(tx, userId, { gradeListId: command.id });
          await tx.gradeEntry.deleteMany({ where });
          await tx.subject.deleteMany({ where });
          await tx.gradeList.delete({ where: { id: command.id, userId } });
          return { id: command.id };
        }
        case "subject.create": {
          await ownedList(tx, userId, command.data.gradeListId);
          const subject = await tx.subject.create({ data: { ...command.data, userId } });
          return { id: subject.id };
        }
        case "subject.update":
        case "subject.delete": {
          const subject = await tx.subject.findFirst({ where: { id: command.id, userId } });
          if (!subject) {
            throw new GradeMutationError("NOT_FOUND");
          }
          await ownedList(tx, userId, subject.gradeListId);
          if (command.action === "subject.update") {
            if (command.data.gradeListId !== subject.gradeListId) {
              throw new GradeMutationError("INVALID_INPUT");
            }
            await tx.subject.update({ where: { id: subject.id, userId }, data: command.data });
          } else {
            const entries = { gradeListId: subject.gradeListId, subjectId: subject.id };
            await queueEntryFiles(tx, userId, entries);
            await tx.gradeEntry.deleteMany({ where: { ...entries, userId } });
            await tx.subject.delete({ where: { id: subject.id, userId } });
          }
          return { id: subject.id };
        }
        case "type.create": {
          const types = await tx.gradeType.findMany({ where: { userId }, select: { name: true } });
          if (
            types.some(
              (type) => normalizedGradeName(type.name) === normalizedGradeName(command.data.name),
            )
          ) {
            throw new GradeMutationError("TYPE_NAME_EXISTS");
          }
          const type = await tx.gradeType.create({ data: { ...command.data, userId } });
          return { id: type.id };
        }
        case "type.update":
        case "type.delete": {
          const type = await tx.gradeType.findFirst({ where: { id: command.id, userId } });
          if (!type) {
            throw new GradeMutationError("NOT_FOUND");
          }
          if (
            command.action === "type.update" &&
            normalizedGradeName(type.name) !== normalizedGradeName(command.data.name)
          ) {
            const others = await tx.gradeType.findMany({
              where: { userId, id: { not: type.id } },
              select: { name: true },
            });
            if (
              others.some(
                (item) => normalizedGradeName(item.name) === normalizedGradeName(command.data.name),
              )
            ) {
              throw new GradeMutationError("TYPE_NAME_EXISTS");
            }
          }
          if (command.action === "type.update") {
            await tx.gradeType.update({ where: { id: type.id, userId }, data: command.data });
          } else {
            await tx.gradeType.delete({ where: { id: type.id, userId } });
          }
          return { id: type.id };
        }
        case "entry.create":
        case "entry.update":
          return saveEntry(tx, userId, command);
        case "entry.delete": {
          const entry = await tx.gradeEntry.findFirst({ where: { id: command.id, userId } });
          if (!entry) {
            throw new GradeMutationError("NOT_FOUND");
          }
          await ownedList(tx, userId, entry.gradeListId);
          await queueEntryFiles(tx, userId, { id: entry.id });
          await tx.gradeEntry.delete({ where: { id: entry.id, userId } });
          return { id: entry.id };
        }
      }
    });
    if (deletesFiles) {
      await cleanupFiles(db);
    }
    if (command.action === "list.status") {
      logEvent(command.status === "ARCHIVED" ? "grades.list_archived" : "grades.list_restored");
    }
    if (command.action === "list.preferences") {
      logEvent("grades.dashboard_preferences_changed");
    }
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002" && command.action === "setup.create") {
        throw new GradeMutationError("INVALID_INPUT");
      }
      if (error.code === "P2003") {
        throw new GradeMutationError("IN_USE");
      }
      if (error.code === "P2025") {
        throw new GradeMutationError("NOT_FOUND");
      }
    }
    throw error;
  }
}
