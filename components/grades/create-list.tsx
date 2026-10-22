"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/provider";
import { SetupWizard } from "@/components/onboarding/setup-wizard";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { OpenIcon } from "@/components/ui/open-icon";
import type { TypeChoice } from "@/lib/grades/types";
import { EditorForm } from "./entity-editor";

export function CreateList({ types }: { types: TypeChoice[] }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "manual" | "tutorial" | null>(null);
  return (
    <>
      <Button onClick={() => setMode("choose")}>{t.newList}</Button>
      {mode === "choose" && (
        <Dialog title={t.createListChoice} onClose={() => setMode(null)}>
          <div className="grid gap-3">
            {(["manual", "tutorial"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className="group flex min-h-24 items-center gap-4 rounded-2xl bg-muted/50 p-5 text-left transition-colors hover:bg-accent focus-visible:outline-offset-4"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="size-7 shrink-0 text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {option === "manual" ? (
                    <>
                      <rect x="5" y="3" width="14" height="18" rx="2" />
                      <path d="M9 8h6m-6 4h6m-6 4h3" />
                    </>
                  ) : (
                    <>
                      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
                    </>
                  )}
                </svg>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {option === "manual" ? t.createListManual : t.createListGuided}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                    {option === "manual" ? t.createListManualHelp : t.createListGuidedHelp}
                  </span>
                </span>
                <OpenIcon />
              </button>
            ))}
          </div>
        </Dialog>
      )}
      {mode === "manual" && (
        <EditorForm kind="list" title={t.newList} onClose={() => setMode(null)} />
      )}
      {mode === "tutorial" && (
        <SetupWizard
          availableTypes={types}
          onClose={() => {
            setMode(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
