import { z } from "zod";

export const localeSchema = z.enum(["en", "de"]);
export type Locale = z.infer<typeof localeSchema>;
export const defaultLocale: Locale = "en";
export const localeCookie = "gradeshelf-language";

export function browserLocale(headers: Headers): Locale {
  const saved = headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${localeCookie}=`))
    ?.slice(localeCookie.length + 1);
  const preference = localeSchema.safeParse(saved);
  if (preference.success) {
    return preference.data;
  }
  const languages = (headers.get("accept-language") ?? "").split(",").map((part) => {
    const [tag, ...parameters] = part.trim().toLowerCase().split(";");
    const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
    return {
      locale: localeSchema.safeParse(tag.split("-")[0]).data,
      quality: quality ? Number(quality.trim().slice(2)) : 1,
    };
  });
  return (
    languages
      .filter(({ locale, quality }) => locale && quality > 0 && quality <= 1)
      .sort((a, b) => b.quality - a.quality)[0]?.locale ?? defaultLocale
  );
}
