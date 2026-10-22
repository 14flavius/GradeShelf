import "dotenv/config";
import { defineConfig } from "prisma/config";
import { getStoragePaths } from "./lib/storage-config.mjs";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: getStoragePaths().databaseUrl },
});
