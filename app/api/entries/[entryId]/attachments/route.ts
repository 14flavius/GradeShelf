import { getAuth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { handleUpload, attachmentErrorResponse } from "@/lib/attachments/http";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  try {
    return await handleUpload(await getDb(), await getAuth(), request, (await params).entryId);
  } catch (error) {
    return attachmentErrorResponse(error);
  }
}
