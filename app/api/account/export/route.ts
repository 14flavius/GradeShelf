import { getAuth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { handleExport, exportErrorResponse } from "@/lib/export/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return await handleExport(await getDb(), await getAuth(), request);
  } catch {
    return exportErrorResponse();
  }
}
