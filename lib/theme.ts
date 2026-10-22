import { z } from "zod";

export const themeSchema = z.enum(["system", "dark", "light"]);
export type Theme = z.infer<typeof themeSchema>;
export const themeStorageKey = "gradeshelf-theme";

export function resolveTheme(value: unknown): Theme {
  const parsed = themeSchema.safeParse(value);
  return parsed.success ? parsed.data : "system";
}

// Static code only: apply the browser preference before the body is painted.
// Restricted storage falls back to the system appearance.
export const themeInitScript = `try{var t=localStorage.getItem(${JSON.stringify(themeStorageKey)});if(t==="light"||t==="dark"||t==="system")document.documentElement.dataset.theme=t;}catch{}`;
