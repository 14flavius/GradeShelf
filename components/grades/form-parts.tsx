import type { ReactNode } from "react";
export const controlClass =
  "w-full rounded-xl border border-input bg-field px-3 py-2 text-base disabled:opacity-50 md:text-sm";

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export function MutationError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </p>
  ) : null;
}
