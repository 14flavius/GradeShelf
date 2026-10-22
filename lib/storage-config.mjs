import path from "node:path";
import { z } from "zod";

// Shared by Prisma CLI, startup scripts and the server. No database is opened here.
export function getStoragePaths() {
  const configuredDir = z
    .string()
    .trim()
    .min(1)
    .parse(process.env.DATA_DIR ?? "/data");
  const dataDir = path.resolve(configuredDir);
  const publicDir = path.resolve("public");
  const relative = path.relative(publicDir, dataDir);
  if (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  ) {
    throw new Error("DATA_DIR darf nicht im öffentlichen Verzeichnis liegen.");
  }
  const databasePath = path.join(dataDir, "gradeshelf.db");
  return {
    dataDir,
    databasePath,
    databaseUrl: `file:${databasePath}`,
    uploadsDir: path.join(dataDir, "uploads"),
  };
}
