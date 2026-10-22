// Only private entry paths are accepted; no external URLs or arbitrary redirects.
export function entryReturnPath(value: unknown): string {
  return typeof value === "string" && /^\/entries\/[A-Za-z0-9_-]{1,128}$/.test(value)
    ? value
    : "/dashboard";
}

export function withReturnPath(page: string, destination: string): string {
  const target = entryReturnPath(destination);
  return target === "/dashboard" ? page : `${page}?returnTo=${encodeURIComponent(target)}`;
}
