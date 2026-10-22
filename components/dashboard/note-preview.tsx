"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/provider";

export function NotePreview({ text, entryTitle }: { text: string; entryTitle: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const previewId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [open]);

  return (
    <div
      ref={container}
      className={`relative ${open ? "z-30" : "z-10"}`}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          setOpen(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          setOpen(false);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={`${t.previewNote}: ${entryTitle}`}
        aria-expanded={open}
        aria-controls={previewId}
        aria-describedby={open ? previewId : undefined}
        onClick={() => setOpen((current) => !current)}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-primary hover:bg-accent"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
          <path d="M14 3v6h6M8 13h8M8 17h5" />
        </svg>
      </button>
      <div
        id={previewId}
        hidden={!open}
        className="absolute left-0 top-full w-64 max-w-[calc(100vw-7rem)] pt-2 sm:left-auto sm:right-0"
      >
        <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-floating">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{t.entryNote}</p>
          <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
