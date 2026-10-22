"use client";

import { settingsSections } from "@/lib/settings-sections";
import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ListChoice, TypeChoice } from "@/lib/grades/types";
import { listTypeSelectionSchema } from "@/lib/grades/setup";
import { TypeChecklist } from "./type-checklist";
import { useGradeMutation } from "./use-grade-mutation";
import { MutationError } from "./form-parts";

export function ListTypeSelector({ list, types }: { list: ListChoice; types: TypeChoice[] }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t.chooseGradeTypes}
      </Button>
      {open && <SelectionForm list={list} types={types} onClose={() => setOpen(false)} />}
    </>
  );
}

function SelectionForm({
  list,
  types,
  onClose,
}: {
  list: ListChoice;
  types: TypeChoice[];
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const mutation = useGradeMutation();
  const [all, setAll] = useState(list.useAllGradeTypes);
  const [ids, setIds] = useState(
    list.useAllGradeTypes
      ? types.map(({ id }) => id)
      : list.gradeTypes.map(({ gradeTypeId }) => gradeTypeId),
  );
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = listTypeSelectionSchema.safeParse({
      useAllGradeTypes: all,
      gradeTypeIds: all ? [] : ids,
    });
    if (!parsed.success) {
      mutation.invalid();
      return;
    }
    if (await mutation.run({ action: "list.types", id: list.id, data: parsed.data })) {
      onClose();
    }
  }

  return (
    <Dialog title={t.chooseGradeTypes} onClose={onClose} busy={mutation.pending}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-muted-foreground">{t.sharedGradeTypesHelp}</p>
        <fieldset disabled={mutation.pending} className="space-y-4">
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={all}
              onChange={(event) => setAll(event.target.checked)}
            />
            {t.allGradeTypesAutomatic}
          </label>
          {!all && <TypeChecklist types={types} selectedIds={ids} onChange={setIds} />}
        </fieldset>
        <Link
          href={{ pathname: "/settings", hash: settingsSections.gradeTypes }}
          className="inline-flex min-h-10 items-center text-sm text-primary underline"
        >
          {t.manageGradeTypes}
        </Link>
        <MutationError message={mutation.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={mutation.pending} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" disabled={mutation.pending}>
            {mutation.pending ? t.saving : t.save}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
