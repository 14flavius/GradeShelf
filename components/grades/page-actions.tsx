"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function PageActions({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent | FocusEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) {
        ref.current?.removeAttribute("open");
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const menu = ref.current;
      if (event.key === "Escape" && menu?.open && !menu.querySelector("dialog[open]")) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  return (
    <details ref={ref} className="group relative">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-lg bg-card px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent [&::-webkit-details-marker]:hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          className="size-4"
        >
          <path d="M4 7h7m4 0h5M4 17h3m4 0h9M11 4v6M7 14v6" />
        </svg>
        {label}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="size-3.5 group-open:rotate-180"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="absolute right-0 top-full z-30 mt-2 flex w-60 max-w-[calc(100vw-2.5rem)] flex-col gap-1 rounded-xl bg-card p-2 shadow-floating [&>button]:w-full [&>button]:justify-start [&>button]:bg-transparent [&>button]:text-left [&>button:hover]:bg-accent">
        {children}
      </div>
    </details>
  );
}
