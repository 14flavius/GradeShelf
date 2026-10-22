"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import type { TypeChoice } from "@/lib/grades/types";
import { SetupWizard } from "./setup-wizard";

export function SetupTutorial({
  autoStart = false,
  userId,
  replay = false,
  availableTypes,
}: {
  autoStart?: boolean;
  userId: string;
  replay?: boolean;
  availableTypes: TypeChoice[];
}) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const router = useRouter();
  useEffect(() => {
    if (!autoStart) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      try {
        if (sessionStorage.getItem(`gradeshelf-tutorial:${userId}`)) {
          return;
        }
      } catch {
        /* Setup remains available when browser storage is blocked. */
      }
      setOpen(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [autoStart, userId]);
  return (
    <>
      <Button variant={replay ? "secondary" : "default"} onClick={() => setOpen(true)}>
        {replay ? t.tutorialRestart : t.tutorialStart}
        <span aria-hidden="true">↗</span>
      </Button>
      {open && (
        <SetupWizard
          availableTypes={availableTypes}
          onClose={() => {
            try {
              sessionStorage.setItem(`gradeshelf-tutorial:${userId}`, "dismissed");
            } catch {
              /* Dismissing the dialog must not depend on storage availability. */
            }
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
