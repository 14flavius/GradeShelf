"use client";

import { useState } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MutationError } from "./form-parts";
import { useGradeMutation } from "./use-grade-mutation";

export function ArchiveButton({
  id,
  name,
  archived,
}: {
  id: string;
  name: string;
  archived: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const mutation = useGradeMutation();
  const label = archived ? t.restoreList : t.archiveList;
  return (
    <>
      <Button variant="secondary" aria-label={`${label}: ${name}`} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <Dialog title={label} onClose={() => setOpen(false)} busy={mutation.pending}>
          <div className="space-y-4">
            <p className="break-words font-medium">{name}</p>
            <p className="text-sm text-muted-foreground">
              {archived ? t.restoreListHelp : t.archiveListHelp}
            </p>
            <MutationError message={mutation.error} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                data-autofocus
                disabled={mutation.pending}
                onClick={() => setOpen(false)}
              >
                {t.cancel}
              </Button>
              <Button
                disabled={mutation.pending}
                onClick={async () => {
                  if (
                    await mutation.run({
                      action: "list.status",
                      id,
                      status: archived ? "ACTIVE" : "ARCHIVED",
                    })
                  ) {
                    setOpen(false);
                  }
                }}
              >
                {mutation.pending ? t.saving : label}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
