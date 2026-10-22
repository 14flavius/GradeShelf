import { getAuth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { handleEntryRead, entryReadError } from "@/lib/grades/entry-details";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  try {
    return await handleEntryRead(await getDb(), await getAuth(), request, (await params).entryId);
  } catch {
    return entryReadError();
  }
}
