export function defaultEntryWeight(typeWeight: number, weightingMode?: "ENTRIES" | "PERCENTAGES") {
  return weightingMode === "PERCENTAGES" ? 1 : typeWeight;
}

export function parseWeightingShares(values: Record<string, string>, typeIds: string[]) {
  return typeIds
    .filter((id) => values[id]?.trim())
    .map((gradeTypeId) => ({
      gradeTypeId,
      share: /^\d+(?:[.,]\d{1,2})?$/.test(values[gradeTypeId].trim())
        ? Math.round(Number(values[gradeTypeId].replace(",", ".")) * 100)
        : NaN,
    }));
}

export function hasCompleteShares(shares: { share: number }[]) {
  return shares.reduce((sum, item) => sum + item.share, 0) === 10000;
}
