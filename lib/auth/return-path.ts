// Only explicit local destinations are accepted, including SSO reauthentication.
export function entryReturnPath(value: unknown): string {
  if (value === "/settings#sso-settings") {
    return value;
  }
  return typeof value === "string" && /^\/entries\/[A-Za-z0-9_-]{1,128}$/.test(value)
    ? value
    : "/dashboard";
}

export function withReturnPath(page: string, destination: string): string {
  const target = entryReturnPath(destination);
  return target === "/dashboard" ? page : `${page}?returnTo=${encodeURIComponent(target)}`;
}
