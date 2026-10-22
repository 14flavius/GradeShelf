// Used only when rendering pages, never for API writes. Cookies are host-bound,
// so switching local hosts starts at sign-in on the configured CSRF origin.
export function localSignInURL(host: string | null, configuredURL: string | undefined): URL | null {
  if (!configuredURL || !URL.canParse(configuredURL)) {
    return null;
  }
  const target = new URL(configuredURL);
  const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];
  if (target.protocol !== "http:" || !loopbackHosts.includes(target.hostname)) {
    return null;
  }
  const localHosts = loopbackHosts.map((name) => `${name}${target.port ? `:${target.port}` : ""}`);
  if (!host || host === target.host || !localHosts.includes(host)) {
    return null;
  }
  target.pathname = "/login";
  target.search = "";
  target.hash = "";
  return target;
}
