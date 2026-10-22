import { getAuth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { handleRecentRead, recentReadError } from "@/lib/grades/recent-read";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    return await handleRecentRead(await getDb(), await getAuth(), request);
  } catch {
    return recentReadError();
  }
}
