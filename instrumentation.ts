export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { getDb } = await import("./lib/db");
    const { ensureStorageReady } = await import("./lib/attachments/storage");
    const { ensureDefaultAdmin } = await import("./lib/auth/bootstrap");
    const { getAttachmentLimits } = await import("./lib/attachments/config");
    const { logEvent } = await import("./lib/logger.mjs");
    try {
      getAttachmentLimits();
      const db = await getDb();
      await ensureStorageReady(db);
      await ensureDefaultAdmin(db);
    } catch {
      logEvent("server.initialization_failed", "error");
      throw new Error(
        "Server initialization failed. Check migrations, DATA_DIR and upload configuration.",
      );
    }
  }
}
