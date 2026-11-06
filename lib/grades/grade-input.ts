// This is an explicit input convention, not a conversion between school systems.
export function parseTendency(input: string): number | null {
  const text = input.trim().replace(/[−–]/g, "-");
  const tendency = /^([1-6])([+-])$/.exec(text);
  if (tendency && !(tendency[1] === "6" && tendency[2] === "-")) {
    return Math.round((Number(tendency[1]) + (tendency[2] === "+" ? -0.3 : 0.3)) * 10) / 10;
  }
  const between = /^([1-5])[-/]([2-6])$/.exec(text);
  if (between && Number(between[2]) === Number(between[1]) + 1) {
    return Number(between[1]) + 0.5;
  }
  return null;
}

export function tendencyText(input: unknown) {
  if (typeof input !== "string" || parseTendency(input) === null) {
    return null;
  }
  return input.trim().replace(/[−–]/g, "-");
}
