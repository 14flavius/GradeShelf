import { useLanguage } from "@/components/i18n/provider";
import { Input } from "@/components/ui/input";
import { parseWeightingShares } from "@/lib/grades/weighting";
import type { TypeChoice } from "@/lib/grades/types";
import { FormField, controlClass } from "./form-parts";

export type WeightingDraft = {
  weightingMode: "ENTRIES" | "PERCENTAGES";
  shares: Record<string, string>;
};

export function WeightingFields({
  value,
  onChange,
  types,
  name = "weighting",
}: {
  value: WeightingDraft;
  onChange: (value: WeightingDraft) => void;
  types: TypeChoice[];
  name?: string;
}) {
  const { t, locale } = useLanguage();
  const total = parseWeightingShares(
    value.shares,
    types.map((type) => type.id),
  ).reduce((sum, item) => sum + item.share, 0);
  return (
    <div className="space-y-3">
      <FormField label={t.weighting}>
        <select
          name={name}
          className={controlClass}
          value={value.weightingMode}
          onChange={(event) =>
            onChange({
              ...value,
              weightingMode: event.target.value === "PERCENTAGES" ? "PERCENTAGES" : "ENTRIES",
            })
          }
        >
          <option value="ENTRIES">{t.weightEntries}</option>
          <option value="PERCENTAGES">{t.weightPercentages}</option>
        </select>
      </FormField>
      <p className="text-sm text-muted-foreground">{t.weightingHelp}</p>
      {value.weightingMode === "PERCENTAGES" && (
        <div className="space-y-3">
          {types.map((type) => (
            <FormField key={type.id} label={`${type.name} (%)`}>
              <Input
                name={`${name}-${type.id}`}
                inputMode="decimal"
                value={value.shares[type.id] ?? ""}
                onChange={(event) =>
                  onChange({ ...value, shares: { ...value.shares, [type.id]: event.target.value } })
                }
              />
            </FormField>
          ))}
          <p
            role="status"
            className={total === 10000 ? "text-sm" : "text-sm text-muted-foreground"}
          >
            {t.percentageTotal}:{" "}
            {Number.isFinite(total) ? new Intl.NumberFormat(locale).format(total / 100) : "—"} % ·{" "}
            {t.percentageRequired}
          </p>
        </div>
      )}
    </div>
  );
}
