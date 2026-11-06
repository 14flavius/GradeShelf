"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/provider";
import { SetupWizard } from "@/components/onboarding/setup-wizard";
import { Button } from "@/components/ui/button";
import type { TypeChoice } from "@/lib/grades/types";

export function CreateList({ types }: { types: TypeChoice[] }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t.newList}</Button>
      {open && (
        <SetupWizard
          introduction={false}
          availableTypes={types}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
