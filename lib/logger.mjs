/** Deliberately accepts event names only: never log requests, errors or credentials. */
export function logEvent(event, level = "info") {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), level, event });
  if (level === "error") {
    console.error(line);
  } else {
    console.info(line);
  }
}
