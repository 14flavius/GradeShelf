import type { MessageKey } from "@/lib/i18n/messages";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

export function Field({
  label,
  id,
  hint,
  ...props
}: ComponentProps<typeof Input> & { id: string; label: string; hint?: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <Input id={id} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  return (
    <>
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-md bg-secondary p-3 text-sm text-secondary-foreground">
          {message}
        </p>
      )}
    </>
  );
}

export function authErrorMessage(
  error: { status?: number; code?: string } | null | undefined,
  fallback: MessageKey,
): MessageKey {
  if (error?.status === 429) {
    return "rateLimited";
  }
  if (error?.status && error.status >= 500) {
    return "serviceUnavailable";
  }
  if (error?.code === "PASSWORD_CHANGE_REQUIRED") {
    return "passwordRequired";
  }
  return fallback;
}
