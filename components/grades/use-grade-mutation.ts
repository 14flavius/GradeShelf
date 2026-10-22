"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/provider";
import type { GradeCommand } from "@/lib/grades/commands";
import type { MessageKey } from "@/lib/i18n/messages";

const errors: Record<string, MessageKey> = {
  INVALID_INPUT: "gradeInvalid",
  NOT_FOUND: "gradeNotFound",
  IN_USE: "gradeInUse",
  SCALE_LOCKED: "scaleLocked",
  ARCHIVED: "archivedReadOnly",
  FORBIDDEN: "gradeForbidden",
  UNAUTHENTICATED: "gradeSignIn",
  PASSWORD_CHANGE_REQUIRED: "passwordRequired",
  TYPE_NAME_EXISTS: "typeNameExists",
};

export function useGradeMutation({ refresh = true }: { refresh?: boolean } = {}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const inFlight = useRef(false);
  const router = useRouter();
  const { t } = useLanguage();
  async function run(command: GradeCommand) {
    if (inFlight.current) {
      return null;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const code =
          body && typeof body === "object" && "code" in body && typeof body.code === "string"
            ? body.code
            : "";
        setError(Object.hasOwn(errors, code) ? errors[code] : "serviceUnavailable");
        return null;
      }
      if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string") {
        setError("serviceUnavailable");
        return null;
      }
      if (refresh) {
        router.refresh();
      }
      return body.id;
    } catch {
      setError("connectionFailed");
      return null;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return { run, pending, error: error ? t[error] : null, invalid: () => setError("gradeInvalid") };
}
