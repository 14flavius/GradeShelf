import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client.ts";
import type { Locale } from "../i18n/config.ts";
import { messages } from "../i18n/messages.ts";
import { calendarCommandSchema, type CalendarFeedView } from "./validation.ts";
import { calendarPreview } from "./render.ts";

export const calendarEntrySelect = {
  id: true,
  title: true,
  date: true,
  grade: true,
  weight: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  gradeList: { select: { name: true, gradingSystemId: true, updatedAt: true } },
  subject: { select: { name: true, updatedAt: true } },
  gradeType: { select: { name: true, updatedAt: true } },
} as const;

export const calendarSettingsSelect = {
  name: true,
  titleTemplate: true,
  descriptionTemplate: true,
  locale: true,
  enabled: true,
  revision: true,
  lists: { select: { gradeListId: true }, orderBy: { gradeListId: "asc" } },
} as const;

export class CalendarError extends Error {
  readonly code: "INVALID_INPUT" | "CONFLICT" | "FORBIDDEN";

  constructor(code: CalendarError["code"]) {
    super(code);
    this.code = code;
  }
}

export function hashCalendarToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function readCalendarSettings(
  db: PrismaClient,
  userId: string,
  locale: Locale,
): Promise<CalendarFeedView> {
  const feed = await db.calendarFeed.findUnique({
    where: { userId },
    select: calendarSettingsSelect,
  });
  if (!feed) {
    return {
      name: "GradeShelf",
      titleTemplate: "{subject}: {title}",
      descriptionTemplate: messages[locale].calendarDefaultDescription,
      locale,
      listIds: [],
      enabled: false,
      revision: 0,
    };
  }
  const { lists, ...settings } = feed;
  return { ...settings, listIds: lists.map((list) => list.gradeListId) };
}

export async function applyCalendarCommand(
  db: PrismaClient,
  userId: string,
  input: unknown,
  baseURL: string,
) {
  const command = calendarCommandSchema.parse(input);
  return db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: userId, isActive: true, mustChangePassword: false },
      select: { id: true },
    });
    if (!user) {
      throw new CalendarError("FORBIDDEN");
    }
    if (command.action === "save" || command.action === "preview") {
      const owned = await tx.gradeList.count({
        where: { userId, id: { in: command.settings.listIds } },
      });
      if (owned !== command.settings.listIds.length) {
        throw new CalendarError("INVALID_INPUT");
      }
      if (command.action === "preview") {
        const entry = await tx.gradeEntry.findFirst({
          where: { userId, gradeListId: { in: command.settings.listIds } },
          orderBy: [{ date: "desc" }, { id: "asc" }],
          select: calendarEntrySelect,
        });
        return { preview: entry ? calendarPreview(entry, command.settings, baseURL) : null };
      }
    }
    const existing = await tx.calendarFeed.findUnique({
      where: { userId },
      select: { id: true, revision: true, enabled: true },
    });
    if ((existing?.revision ?? 0) !== command.revision) {
      throw new CalendarError("CONFLICT");
    }
    let url: string | undefined;
    if (command.action === "save") {
      const { listIds, ...settings } = command.settings;
      const feed = existing
        ? await tx.calendarFeed.update({
            where: { id: existing.id, userId },
            data: { ...settings, revision: { increment: 1 } },
          })
        : await tx.calendarFeed.create({ data: { ...settings, userId } });
      await tx.calendarFeedList.deleteMany({ where: { feedId: feed.id, userId } });
      if (listIds.length) {
        await tx.calendarFeedList.createMany({
          data: listIds.map((gradeListId) => ({ feedId: feed.id, userId, gradeListId })),
        });
      }
    } else {
      if (!existing) {
        throw new CalendarError("INVALID_INPUT");
      }
      if (
        (command.action === "enable" && existing.enabled) ||
        (command.action === "rotate" && !existing.enabled)
      ) {
        throw new CalendarError("CONFLICT");
      }
      const token = command.action === "disable" ? null : randomBytes(32).toString("base64url");
      await tx.calendarFeed.update({
        where: { id: existing.id, userId },
        data: {
          enabled: token !== null,
          tokenHash: token ? hashCalendarToken(token) : null,
          revision: { increment: 1 },
        },
      });
      if (token) {
        url = `${baseURL}/calendar/${token}/feed.ics`;
      }
    }
    const result = await tx.calendarFeed.findUniqueOrThrow({
      where: { userId },
      select: calendarSettingsSelect,
    });
    const { lists, ...settings } = result;
    return {
      feed: { ...settings, listIds: lists.map((list) => list.gradeListId) },
      ...(url ? { url } : {}),
    };
  });
}
