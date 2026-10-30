/** Deliberately accepts event names only: never log requests, errors or credentials. */
export function logEvent(event, level = "info") {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), level, event });
  if (level === "error") {
    console.error(line);
  } else {
    console.info(line);
  }
}

/**
 * Only explicit audit fields are accepted; never pass request or account objects.
 * @param {{ actorId: string, userId: string, fromRole: "USER" | "ADMIN", toRole: "USER" | "ADMIN" }} change
 */
export function logRoleChange({ actorId, userId, fromRole, toRole }) {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "admin.role_changed",
      actorId,
      userId,
      fromRole,
      toRole,
    }),
  );
}
