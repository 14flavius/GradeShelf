"use client";

import { useState } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "./form-parts";

const palette = [
  { value: "#2563EB", label: "colorBlue" },
  { value: "#6366F1", label: "colorIndigo" },
  { value: "#9333EA", label: "colorPurple" },
  { value: "#DB2777", label: "colorPink" },
  { value: "#E11D48", label: "colorRose" },
  { value: "#EA580C", label: "colorOrange" },
  { value: "#D97706", label: "colorAmber" },
  { value: "#16A34A", label: "colorGreen" },
  { value: "#0D9488", label: "colorTeal" },
  { value: "#64748B", label: "colorSlate" },
] as const;

export function SubjectColorPicker({ defaultValue }: { defaultValue?: string | null }) {
  const { t } = useLanguage();
  const [color, setColor] = useState(defaultValue?.toUpperCase() ?? "");
  const validColor = /^#[0-9A-F]{6}$/.test(color);
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-sm font-medium">{t.color}</legend>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10 sm:gap-1">
        {palette.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-label={t[label]}
            title={t[label]}
            aria-pressed={color === value}
            onClick={() => setColor(value)}
            className="group flex min-h-11 items-center justify-center rounded-xl disabled:opacity-50"
          >
            <span
              className={`flex size-8 items-center justify-center rounded-full transition-[scale,box-shadow] duration-150 motion-safe:group-hover:scale-110 ${color === value ? "ring-2 ring-foreground/60 ring-offset-2 ring-offset-card" : ""}`}
              style={{ backgroundColor: value }}
            >
              {color === value && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="size-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 12 4 4 10-10" />
                </svg>
              )}
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm font-medium transition-colors hover:bg-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
          <span
            aria-hidden="true"
            className="size-6 rounded-full"
            style={{
              background:
                "conic-gradient(#f43f5e, #f59e0b, #22c55e, #06b6d4, #6366f1, #d946ef, #f43f5e)",
            }}
          />
          {t.customColor}
          <input
            type="color"
            aria-label={t.customColor}
            value={validColor ? color : "#6366F1"}
            onChange={(event) => setColor(event.target.value.toUpperCase())}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <Button variant="secondary" aria-pressed={color === ""} onClick={() => setColor("")}>
          {t.noColor}
        </Button>
      </div>
      <div className="flex items-end gap-3 rounded-xl bg-muted/40 p-4">
        <span
          aria-hidden="true"
          className="mb-1 size-9 shrink-0 rounded-lg border border-border"
          style={{ backgroundColor: validColor ? color : "var(--card)" }}
        />
        <div className="min-w-0 flex-1">
          <FormField label={t.colorHex}>
            <Input
              name="color"
              value={color}
              onChange={(event) => setColor(event.target.value.toUpperCase())}
              maxLength={7}
              pattern="#[0-9a-fA-F]{6}"
              placeholder="#6366F1"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </FormField>
        </div>
      </div>
    </fieldset>
  );
}
