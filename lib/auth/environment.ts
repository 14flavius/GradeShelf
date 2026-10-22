import { z } from "zod";

export function getAuthEnvironment() {
  const result = z
    .object({
      BETTER_AUTH_SECRET: z.string().min(32),
      BETTER_AUTH_URL: z.url().refine((value) => {
        const url = new URL(value);
        return (
          ["http:", "https:"].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          url.pathname === "/" &&
          !url.search &&
          !url.hash
        );
      }),
    })
    .safeParse(process.env);
  if (!result.success) {
    throw new Error(
      "BETTER_AUTH_SECRET (mindestens 32 Zeichen) und BETTER_AUTH_URL müssen gültig konfiguriert sein.",
    );
  }
  return {
    secret: result.data.BETTER_AUTH_SECRET,
    baseURL: new URL(result.data.BETTER_AUTH_URL).origin,
  };
}
