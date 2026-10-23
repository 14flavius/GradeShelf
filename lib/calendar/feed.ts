import { createHash } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client.ts";
import { localCalendarDate } from "../grades/dates.ts";
import { logEvent } from "../logger.mjs";
import { calendarEntrySelect, hashCalendarToken } from "./service.ts";
import { calendarEvent, calendarHeader } from "./render.ts";

const ttl = 60_000;
const maxFeedBytes = 8 * 1024 * 1024;
const maxCacheBytes = 16 * 1024 * 1024;
type Payload = { body: string; etag: string; bytes: number; expires: number };

function findFeed(db: PrismaClient, tokenHash: string) {
  return db.calendarFeed.findFirst({
    where: { tokenHash, enabled: true, user: { isActive: true, mustChangePassword: false } },
    select: {
      id: true,
      userId: true,
      revision: true,
      name: true,
      titleTemplate: true,
      descriptionTemplate: true,
      locale: true,
      updatedAt: true,
      lists: { select: { gradeListId: true }, orderBy: { gradeListId: "asc" } },
    },
  });
}
type Feed = NonNullable<Awaited<ReturnType<typeof findFeed>>>;

function identity(feed: Feed) {
  return JSON.stringify([feed.id, feed.revision, feed.lists.map((list) => list.gradeListId)]);
}

async function buildFeed(db: PrismaClient, feed: Feed, baseURL: string, today: string) {
  return db.$transaction(
    async (tx) => {
      const chunks = [calendarHeader(feed.name)];
      const footer = "END:VCALENDAR\r\n";
      let bytes = Buffer.byteLength(chunks[0]) + Buffer.byteLength(footer);
      let after: string | undefined;
      while (feed.lists.length) {
        const entries = await tx.gradeEntry.findMany({
          where: {
            userId: feed.userId,
            gradeListId: { in: feed.lists.map((list) => list.gradeListId) },
            ...(after ? { id: { gt: after } } : {}),
          },
          orderBy: { id: "asc" },
          take: 250,
          select: calendarEntrySelect,
        });
        for (const entry of entries) {
          const event = calendarEvent(entry, feed, baseURL, today);
          bytes += Buffer.byteLength(event);
          if (bytes > maxFeedBytes) {
            throw new Error("CALENDAR_TOO_LARGE");
          }
          chunks.push(event);
        }
        if (entries.length < 250) {
          break;
        }
        after = entries.at(-1)?.id;
      }
      chunks.push(footer);
      const body = chunks.join("");
      return {
        body,
        bytes: Buffer.byteLength(body),
        etag: `W/"${createHash("sha256").update(body).digest("hex")}"`,
        expires: Date.now() + ttl,
      };
    },
    { timeout: 30_000 },
  );
}

/** One bounded cache per database connection; concurrent readers share one build. */
export function createCalendarFeedReader(db: PrismaClient) {
  const cache = new Map<string, Payload>();
  const builds = new Map<string, Promise<Payload>>();
  const requests = new Map<string, { count: number; reset: number }>();
  let cacheBytes = 0;
  let totalRequests = 0;
  let totalReset = 0;

  function remember(key: string, value: Payload) {
    for (const [entryKey, entry] of cache) {
      if (entry.expires <= Date.now() || entryKey === key) {
        cache.delete(entryKey);
        cacheBytes -= entry.bytes;
      }
    }
    while (cache.size >= 64 || cacheBytes + value.bytes > maxCacheBytes) {
      const oldest = cache.entries().next().value;
      if (!oldest) {
        break;
      }
      cache.delete(oldest[0]);
      cacheBytes -= oldest[1].bytes;
    }
    cache.set(key, value);
    cacheBytes += value.bytes;
  }

  return async (request: Request, token: string, baseURL: string): Promise<Response> => {
    const error = (status: number, retry?: number) =>
      new Response(null, {
        status,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          ...(retry ? { "Retry-After": String(retry) } : {}),
        },
      });
    const now = Date.now();
    if (now >= totalReset) {
      totalRequests = 0;
      totalReset = now + ttl;
    }
    if (++totalRequests > 2000) {
      return error(429, Math.ceil((totalReset - now) / 1000));
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return error(404);
    }
    try {
      const tokenHash = hashCalendarToken(token);
      // Never let cached content or a conditional request bypass revocation/account checks.
      const feed = await findFeed(db, tokenHash);
      if (!feed) {
        return error(404);
      }
      for (const [id, rate] of requests) {
        if (rate.reset <= now) {
          requests.delete(id);
        }
      }
      const rate = requests.get(feed.id) ?? { count: 0, reset: now + ttl };
      if (++rate.count > 60) {
        return error(429, Math.ceil((rate.reset - now) / 1000));
      }
      if (!requests.has(feed.id) && requests.size >= 2000) {
        return error(503, 60);
      }
      requests.set(feed.id, rate);
      const today = localCalendarDate();
      const key = JSON.stringify([identity(feed), baseURL, today]);
      let payload = cache.get(key);
      if (!payload || payload.expires <= now) {
        let pending = builds.get(key);
        if (!pending) {
          if (builds.size >= 4) {
            return error(503, 5);
          }
          pending = buildFeed(db, feed, baseURL, today)
            .then((value) => {
              remember(key, value);
              return value;
            })
            .finally(() => builds.delete(key));
          builds.set(key, pending);
        }
        payload = await pending;
      }
      // A rotation, list change or account disable may have happened during generation.
      const current = await findFeed(db, tokenHash);
      if (!current) {
        return error(404);
      }
      if (identity(current) !== identity(feed)) {
        return error(503, 1);
      }
      const headers = {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="gradeshelf.ics"',
        "Cache-Control": "private, no-cache, must-revalidate",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        ETag: payload.etag,
      };
      const matches = request.headers
        .get("if-none-match")
        ?.split(",")
        .some(
          (tag) =>
            tag.trim() === "*" ||
            tag.trim().replace(/^W\//, "") === payload.etag.replace(/^W\//, ""),
        );
      if (matches) {
        return new Response(null, { status: 304, headers });
      }
      return new Response(request.method === "HEAD" ? null : payload.body, { headers });
    } catch {
      // The request URL contains a secret. Never log request/error objects here.
      logEvent("calendar.feed_failed", "error");
      return error(503, 60);
    }
  };
}

const readers = new WeakMap<PrismaClient, ReturnType<typeof createCalendarFeedReader>>();
export function getCalendarFeedReader(db: PrismaClient) {
  let reader = readers.get(db);
  if (!reader) {
    reader = createCalendarFeedReader(db);
    readers.set(db, reader);
  }
  return reader;
}
