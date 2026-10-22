"use client";

import { useLanguage } from "@/components/i18n/provider";

export function PasswordMatchHint({
  id,
  password,
  confirmation,
}: {
  id: string;
  password: string;
  confirmation: string;
}) {
  const { t } = useLanguage();
  const matches = confirmation.length > 0 && confirmation === password;
  return (
    <p
      id={id}
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 text-sm ${matches ? "text-success" : "text-muted-foreground"}`}
    >
      {matches && (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="size-4 shrink-0"
        >
          <path d="m5 12 4 4L19 6" />
        </svg>
      )}
      {confirmation.length > 0 ? (matches ? t.passwordsMatch : t.passwordMismatch) : ""}
    </p>
  );
}
