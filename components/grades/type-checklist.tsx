import { useLanguage } from "@/components/i18n/provider";
import type { TypeChoice } from "@/lib/grades/types";

export function TypeChecklist({
  types,
  selectedIds,
  onChange,
}: {
  types: TypeChoice[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t, locale } = useLanguage();
  const allSelected = types.length > 0 && types.every((type) => selectedIds.includes(type.id));
  return (
    <fieldset className="space-y-3 disabled:opacity-60">
      <legend className="sr-only">{t.existingGradeTypes}</legend>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          className="size-5 accent-primary"
          checked={allSelected}
          onChange={(event) => onChange(event.target.checked ? types.map(({ id }) => id) : [])}
        />
        {t.selectAllTypes}
      </label>
      <div className="grid gap-2">
        {types.map((type) => (
          <label
            key={type.id}
            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl p-4 transition-colors ${selectedIds.includes(type.id) ? "bg-primary/5" : "bg-muted/40"}`}
          >
            <input
              type="checkbox"
              name="existingTypeIds"
              value={type.id}
              className="size-5 shrink-0 accent-primary"
              checked={selectedIds.includes(type.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selectedIds, type.id]
                    : selectedIds.filter((id) => id !== type.id),
                )
              }
            />
            <span className="min-w-0 flex-1 break-words text-sm [overflow-wrap:anywhere]">
              {type.name}
            </span>
            <span
              className="shrink-0 text-sm tabular-nums text-muted-foreground"
              aria-label={`${t.weight}: ${type.weight}`}
            >
              × {new Intl.NumberFormat(locale).format(type.weight)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
