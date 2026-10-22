import type { ReactNode } from "react";

export function SettingsPanel({
  id,
  title,
  status,
  children,
}: {
  id: string;
  title: string;
  status?: string;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      className="group min-w-0 rounded-2xl bg-card text-card-foreground shadow-surface"
    >
      <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 space-y-1">
          <h3 className="font-medium">{title}</h3>
          {status && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {status}
            </p>
          )}
        </div>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="size-4 shrink-0 text-muted-foreground group-open:rotate-180"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="p-5">{children}</div>
    </details>
  );
}
