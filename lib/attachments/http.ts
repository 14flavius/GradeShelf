import { readRequestBody } from "../request-body.ts";
import { ZodError } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Auth } from "../auth/core.ts";
import { readCurrentUser } from "../auth/access.ts";
import { getAuthEnvironment } from "../auth/environment.ts";
import { logEvent } from "../logger.mjs";
import { AttachmentError } from "./errors.ts";
import { attachmentIdSchema, attachmentNameSchema } from "./rules.ts";
import { getAttachmentLimits } from "./config.ts";
import { checkStorageQuota } from "./usage.ts";
import {
  deleteAttachment,
  downloadAttachment,
  uploadAttachment,
  writableEntry,
} from "./service.ts";

const json = (body: object, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
// One application process: bound upload buffering, including slow request bodies.
const activeUploads = new Set<string>();

export function attachmentErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return json({ code: "INVALID_FILE" }, 400);
  }
  if (error instanceof AttachmentError) {
    const statuses = {
      INVALID_FILE: 400,
      TOO_LARGE: 413,
      TOO_MANY: 409,
      QUOTA_EXCEEDED: 409,
      NOT_FOUND: 404,
      FILE_MISSING: 404,
      ARCHIVED: 409,
      UNAUTHENTICATED: 401,
      PASSWORD_CHANGE_REQUIRED: 403,
    };
    return json({ code: error.code }, statuses[error.code]);
  }
  logEvent("attachments.operation_failed", "error");
  return json({ code: "UNAVAILABLE" }, 503);
}

async function userForRequest(db: PrismaClient, auth: Auth, request: Request) {
  const user = await readCurrentUser(db, auth, request.headers);
  if (!user) {
    throw new AttachmentError("UNAUTHENTICATED");
  }
  if (user.mustChangePassword) {
    throw new AttachmentError("PASSWORD_CHANGE_REQUIRED");
  }
  return user;
}

async function readUpload(request: Request) {
  const { maxFileSize } = getAttachmentLimits();
  const length = request.headers.get("content-length");
  if (length && Number(length) > maxFileSize) {
    throw new AttachmentError("TOO_LARGE");
  }
  if (!request.body) {
    throw new AttachmentError("INVALID_FILE");
  }
  const bytes = await readRequestBody(request, maxFileSize);
  if (bytes === null) {
    throw new AttachmentError("TOO_LARGE");
  }
  return bytes;
}

export async function handleUpload(
  db: PrismaClient,
  auth: Auth,
  request: Request,
  entryId: string,
) {
  let uploadingUser: string | undefined;
  try {
    if (request.headers.get("origin") !== getAuthEnvironment().baseURL) {
      return json({ code: "FORBIDDEN" }, 403);
    }
    const user = await userForRequest(db, auth, request);
    attachmentIdSchema.parse(entryId);
    await writableEntry(db, user.id, entryId);
    if (request.headers.get("content-type") !== "application/octet-stream") {
      return json({ code: "INVALID_FILE" }, 415);
    }
    let name: string;
    try {
      name = decodeURIComponent(request.headers.get("x-file-name") ?? "");
    } catch {
      return attachmentErrorResponse(new AttachmentError("INVALID_FILE"));
    }
    attachmentNameSchema.parse(name);
    if (activeUploads.has(user.id) || activeUploads.size >= 4) {
      return json({ code: "UPLOAD_BUSY" }, 429);
    }
    activeUploads.add(user.id);
    uploadingUser = user.id;
    const { maxAttachments } = getAttachmentLimits();
    const length = Number(request.headers.get("content-length"));
    await checkStorageQuota(db, user.id, Number.isSafeInteger(length) && length > 0 ? length : 1);
    // Fast rejection before reading bytes; the transaction checks the limit again.
    if (
      (await db.attachment.count({ where: { userId: user.id, gradeEntryId: entryId } })) >=
      maxAttachments
    ) {
      return attachmentErrorResponse(new AttachmentError("TOO_MANY"));
    }
    const attachment = await uploadAttachment(
      db,
      user.id,
      entryId,
      name,
      await readUpload(request),
    );
    return json({ attachment }, 201);
  } catch (error) {
    return attachmentErrorResponse(error);
  } finally {
    if (uploadingUser) {
      activeUploads.delete(uploadingUser);
    }
  }
}

export async function handleAttachment(db: PrismaClient, auth: Auth, request: Request, id: string) {
  try {
    if (
      request.method === "DELETE" &&
      request.headers.get("origin") !== getAuthEnvironment().baseURL
    ) {
      return json({ code: "FORBIDDEN" }, 403);
    }
    const user = await userForRequest(db, auth, request);
    if (request.method === "DELETE") {
      await deleteAttachment(db, user.id, id);
      return json({ deleted: true }, 200);
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      return json({ code: "INVALID_FILE" }, 405);
    }
    const { attachment, bytes } = await downloadAttachment(db, user.id, id);
    const encoded = encodeURIComponent(attachment.originalName).replace(
      /['()*]/g,
      (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase(),
    );
    return new Response(request.method === "HEAD" ? null : new Uint8Array(bytes), {
      headers: {
        // Treat even valid PDFs/images as untrusted bytes; never render on our origin.
        "Content-Type": "application/octet-stream",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="download"; filename*=UTF-8''${encoded}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) {
    return attachmentErrorResponse(error);
  }
}
