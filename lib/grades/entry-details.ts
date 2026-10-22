import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Auth } from "../auth/core.ts";
import { readCurrentUser } from "../auth/access.ts";
import { logEvent } from "../logger.mjs";
import { z } from "zod";

const entryId = z.string().min(1).max(128);

function entrySelect(userId: string) {
  return {
    id: true,
    gradeListId: true,
    subjectId: true,
    gradeTypeId: true,
    title: true,
    date: true,
    gradedAt: true,
    grade: true,
    weight: true,
    note: true,
    gradeList: { select: { gradingSystemId: true } },
    attachments: {
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, originalName: true, size: true },
    },
    subject: { select: { name: true } },
    gradeType: { select: { name: true } },
  } satisfies Prisma.GradeEntrySelect;
}

export async function getEntryDetails(db: PrismaClient, userId: string, id: string) {
  if (!entryId.safeParse(id).success) {
    return null;
  }
  return db.gradeEntry.findFirst({
    where: { id, userId },
    select: {
      ...entrySelect(userId),
      gradeList: { select: { name: true, status: true, gradingSystemId: true } },
    },
  });
}

export async function getListEntries(
  db: PrismaClient,
  userId: string,
  gradeListId: string,
  subjectId?: string,
) {
  const entries = [];
  let after: Prisma.GradeEntryWhereInput = {};
  // Prisma resolves selected relations using bound parameters. Small batches avoid
  // SQLite's parameter limit while retaining the complete list for its averages.
  const batchSize = 200;
  while (true) {
    const batch = await db.gradeEntry.findMany({
      where: { userId, gradeListId, ...(subjectId ? { subjectId } : {}), ...after },
      orderBy: [{ date: "desc" }, { id: "asc" }],
      take: batchSize,
      select: entrySelect(userId),
    });
    entries.push(...batch);
    const last = batch.at(-1);
    if (batch.length < batchSize || !last) {
      return entries;
    }
    // Compare values so deleting the last entry during pagination cannot truncate it.
    after = { OR: [{ date: { lt: last.date } }, { date: last.date, id: { gt: last.id } }] };
  }
}

const json = (body: object, status: number) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });

export function entryReadError() {
  logEvent("grades.read_failed", "error");
  return json({ code: "UNAVAILABLE" }, 503);
}

export async function handleEntryRead(db: PrismaClient, auth: Auth, request: Request, id: string) {
  try {
    const user = await readCurrentUser(db, auth, request.headers);
    if (!user) {
      return json({ code: "UNAUTHENTICATED" }, 401);
    }
    if (user.mustChangePassword) {
      return json({ code: "PASSWORD_CHANGE_REQUIRED" }, 403);
    }
    const entry = await getEntryDetails(db, user.id, id);
    return entry ? json({ entry }, 200) : json({ code: "NOT_FOUND" }, 404);
  } catch {
    return entryReadError();
  }
}
