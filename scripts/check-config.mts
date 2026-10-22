import "dotenv/config";
import { getAuthEnvironment } from "../lib/auth/environment.ts";
import { getAttachmentLimits } from "../lib/attachments/config.ts";

try {
  getAuthEnvironment();
} catch {
  console.error(
    "Konfiguration ungültig: BETTER_AUTH_SECRET (mindestens 32 Zeichen) und BETTER_AUTH_URL müssen gesetzt sein. Siehe .env.example.",
  );
  process.exitCode = 1;
}

try {
  getAttachmentLimits();
} catch {
  console.error(
    "Invalid upload configuration. Check UPLOAD_MAX_FILE_MB, UPLOAD_MAX_FILES_PER_ENTRY and UPLOAD_MAX_USER_GB in .env.example.",
  );
  process.exitCode = 1;
}
