"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { deleteConfirmationSchema } from "@/lib/grades/commands";
import { controlClass, FormField, MutationError } from "./form-parts";
import { useGradeMutation } from "./use-grade-mutation";

export function DeleteButton({
  kind,
  id,
  name,
  returnTo,
}: {
  kind: "list" | "subject" | "type" | "entry";
  id: string;
  name: string;
  returnTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  return (
    <>
      <Button variant="secondary" aria-label={`${t.delete}: ${name}`} onClick={() => setOpen(true)}>
        {t.delete}
      </Button>
      {open && (
        <DeleteDialog
          kind={kind}
          id={id}
          name={name}
          returnTo={returnTo}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DeleteDialog({
  kind,
  id,
  name,
  returnTo,
  onClose,
}: {
  kind: "list" | "subject" | "type" | "entry";
  id: string;
  name: string;
  returnTo?: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const mutation = useGradeMutation();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const requiresConfirmation = kind === "list" || kind === "subject";
  const confirmed =
    !requiresConfirmation || deleteConfirmationSchema.safeParse(confirmation).success;
  const description = {
    list: t.deleteListConfirm,
    subject: t.deleteSubjectConfirm,
    type: t.deleteTypeConfirm,
    entry: t.deleteEntryConfirm,
  }[kind];
  async function handleDelete() {
    if (!confirmed) {
      return;
    }
    if (
      await mutation.run(
        kind === "list" || kind === "subject"
          ? { action: `${kind}.delete`, id, confirmation }
          : { action: `${kind}.delete`, id },
      )
    ) {
      onClose();
      if (returnTo) {
        router.push(returnTo);
      }
    }
  }

  return (
    <Dialog title={t.delete} onClose={onClose} busy={mutation.pending}>
      <div className="space-y-4">
        <p className="break-words font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {requiresConfirmation && (
          <FormField label={t.deleteConfirmation}>
            <input
              name="confirmation"
              className={controlClass}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              maxLength={32}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={mutation.pending}
            />
          </FormField>
        )}
        <MutationError message={mutation.error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" data-autofocus disabled={mutation.pending} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.pending || !confirmed}
            onClick={handleDelete}
          >
            {mutation.pending ? t.saving : t.delete}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
