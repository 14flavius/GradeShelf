"use client";

import { useState } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Dialog } from "@/components/ui/dialog";

export function AdminContact({ contact }: { contact: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [before, after] = t.credentialsHelp.split("{administrator}");

  return (
    <>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        {before}
        {contact ? (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
            className="rounded-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-current"
          >
            {t.administratorLink}
          </button>
        ) : (
          t.administratorLink
        )}
        {after}
      </p>
      {open && (
        <Dialog title={t.adminContactTitle} onClose={() => setOpen(false)}>
          <p className="whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">
            {contact}
          </p>
        </Dialog>
      )}
    </>
  );
}
