import { parseArgs } from "node:util";
import { mkdir, realpath, lstat, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { prepareLegacyImport, writeLegacyImport } from "../lib/import/legacy.ts";
import { z } from "zod";
import { storageNameSchema } from "../lib/attachments/rules.ts";

async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: "string" },
      target: { type: "string" },
      apply: { type: "boolean", default: false },
    },
  });
  if (!values.source || !values.target) {
    throw new Error(
      "Usage: npm run import:legacy -- --source /path/to/source-data --target /path/to/new-data [--apply]",
    );
  }
  const sourceDir = await realpath(values.source);
  const requestedTarget = path.resolve(values.target);
  const targetDir = path.join(
    await realpath(path.dirname(requestedTarget)),
    path.basename(requestedTarget),
  );
  const relative = path.relative(sourceDir, targetDir);
  if (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  ) {
    throw new Error("LEGACY_TARGET_INVALID");
  }
  const source = new Database(path.join(sourceDir, "gradeshelf.db"), {
    readonly: true,
    fileMustExist: true,
  });
  let plan: ReturnType<typeof prepareLegacyImport>;
  try {
    // One read snapshot; no source writes, schema changes or execution of source SQL.
    plan = source.transaction(() => prepareLegacyImport(source))();
  } finally {
    source.close();
  }
  const files = plan.tables.get("attachment")!.map((row) =>
    z
      .object({
        storageName: storageNameSchema,
        size: z.number().int().nonnegative(),
      })
      .parse(row),
  );
  for (const file of files) {
    const stat = await lstat(path.join(sourceDir, "uploads", file.storageName));
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.size) {
      throw new Error("LEGACY_ATTACHMENT_INVALID");
    }
  }
  console.log(
    JSON.stringify({ mode: values.apply ? "import" : "preview", ...plan.summary }, null, 2),
  );
  console.log(
    "Final grades stay empty. Unassigned periods and types require review. Calculations use the corrected rules.",
  );
  if (!values.apply) {
    return;
  }
  // Must be a new directory: never overwrite an installation or merge identities.
  await mkdir(targetDir, { recursive: false, mode: 0o700 });
  let target: Database.Database | undefined;
  let complete = false;
  try {
    const root = fileURLToPath(new URL("../", import.meta.url));
    execFileSync(
      process.execPath,
      [path.join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"],
      {
        cwd: root,
        env: { ...process.env, DATA_DIR: targetDir, CHECKPOINT_DISABLE: "1" },
        stdio: "pipe",
      },
    );
    target = new Database(path.join(targetDir, "gradeshelf.db"));
    writeLegacyImport(target, plan);
    await mkdir(path.join(targetDir, "uploads"), { mode: 0o700 });
    for (const file of files) {
      await copyFile(
        path.join(sourceDir, "uploads", file.storageName),
        path.join(targetDir, "uploads", file.storageName),
      );
      if ((await lstat(path.join(targetDir, "uploads", file.storageName))).size !== file.size) {
        throw new Error("LEGACY_ATTACHMENT_CHANGED");
      }
    }
    target.close();
    target = undefined;
    complete = true;
    console.log(
      "Import complete. Start GradeShelf with DATA_DIR pointing to the new directory and the existing authentication secret.",
    );
  } finally {
    target?.close();
    // Only the new directory created by this invocation may be removed on failure.
    if (!complete) {
      await rm(targetDir, { recursive: true, force: true });
    }
  }
}
main().catch((error: unknown) => {
  const known =
    error instanceof Error &&
    (/^LEGACY_[A-Z_]+$/.test(error.message) || error.message.startsWith("Usage:"));
  console.error(
    known
      ? error.message
      : "Import failed. Check the source schema, data, attachment files and that the target directory does not exist. The source was not changed.",
  );
  process.exitCode = 1;
});
