import { getAuth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { handleAdminRequest, adminErrorResponse } from "@/lib/admin/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return await handleAdminRequest(await getDb(), await getAuth(), request);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
