import { cpSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const standalone = path.resolve(".next/standalone");
// Next.js copies loaded .env files explicitly, independently of tracing exclusions.
// Remove only generated copies; the repository's actual configuration is untouched.
for (const entry of readdirSync(standalone, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.startsWith(".env")) {
    rmSync(path.join(standalone, entry.name));
  }
}
// Instrumentation traces bypass route-level exclusions and can copy local runtime data.
rmSync(path.join(standalone, "data"), { recursive: true, force: true });
cpSync(".next/static", path.join(standalone, ".next/static"), { recursive: true });
cpSync("public", path.join(standalone, "public"), { recursive: true });
