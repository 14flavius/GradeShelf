import { getAuthEnvironment } from "../lib/auth/environment.ts";
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import { stdin, stdout } from "node:process";
import { connectDatabase } from "../lib/database.ts";
import { BootstrapInputError, createAdmin } from "../lib/auth/bootstrap.ts";
import { passwordSchema, usernameSchema } from "../lib/auth/validation.ts";

async function hiddenPassword(prompt: string): Promise<string> {
  stdout.write(prompt);
  const previousRawMode = stdin.isRaw;
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    function cleanup() {
      stdin.off("keypress", onKey);
      stdin.setRawMode(previousRawMode);
      stdin.pause();
      stdout.write("\n");
    }
    function onKey(
      text: string | undefined,
      key: { name?: string; ctrl?: boolean; meta?: boolean },
    ) {
      if (key.ctrl && (key.name === "c" || key.name === "d")) {
        cleanup();
        reject(new BootstrapInputError("Abgebrochen."));
      } else if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(value);
      } else if (key.name === "backspace") {
        value = [...value].slice(0, -1).join("");
      } else if (
        text &&
        !key.ctrl &&
        !key.meta &&
        !/[\x00-\x1f\x7f]/.test(text) &&
        value.length + text.length <= 128
      ) {
        value += text;
      }
    }
    stdin.on("keypress", onKey);
  });
}

async function main() {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new BootstrapInputError(
      "Bitte in einem interaktiven Terminal ausführen (Docker: docker compose exec gradeshelf npm run admin:create).",
    );
  }
  try {
    getAuthEnvironment();
  } catch {
    throw new BootstrapInputError(
      "Bitte BETTER_AUTH_SECRET und BETTER_AUTH_URL gemäß .env.example konfigurieren.",
    );
  }
  const db = await connectDatabase();
  try {
    const prompt = createInterface({ input: stdin, output: stdout });
    let username: string;
    try {
      username = await prompt.question("Benutzername für den neuen Admin: ");
    } finally {
      prompt.close();
    }
    if (!usernameSchema.safeParse(username).success) {
      throw new BootstrapInputError(
        "Benutzername: 3–32 Zeichen, beginnend mit Buchstabe/Zahl; erlaubt sind a–z, 0–9, Punkt, Bindestrich und Unterstrich.",
      );
    }
    const password = await hiddenPassword("Temporäres Passwort (12–128 Zeichen, verdeckt): ");
    if (!passwordSchema.safeParse(password).success) {
      throw new BootstrapInputError("Das Passwort muss 12–128 Zeichen lang sein.");
    }
    if (password !== (await hiddenPassword("Passwort wiederholen: "))) {
      throw new BootstrapInputError("Die Passwörter stimmen nicht überein.");
    }
    await createAdmin(db, { username, password });
    stdout.write("Admin erstellt. Beim ersten Login muss das Passwort geändert werden.\n");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Only intentional local input errors are shown; database errors can contain credentials.
  const known = error instanceof BootstrapInputError;
  console.error(
    known
      ? error.message
      : "Admin konnte nicht erstellt werden. Konfiguration, Migrationen und Benutzername prüfen.",
  );
  process.exitCode = 1;
});
