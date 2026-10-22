import { getAuth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { handleAttachment, attachmentErrorResponse } from "@/lib/attachments/http";

export const runtime = "nodejs";

async function handle(request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  try {
    return await handleAttachment(
      await getDb(),
      await getAuth(),
      request,
      (await params).attachmentId,
    );
  } catch (error) {
    return attachmentErrorResponse(error);
  }
}

export { handle as GET, handle as HEAD, handle as DELETE };
