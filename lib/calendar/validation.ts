import { z } from "zod";
import { localeSchema } from "../i18n/config.ts";

export const calendarVariables = [
  "title",
  "subject",
  "list",
  "type",
  "date",
  "status",
  "grade",
  "weight",
  "note",
  "url",
] as const;
export type CalendarVariable = (typeof calendarVariables)[number];

function validTemplate(value: string) {
  const remainder = value.replace(/\{([a-z]+)\}/g, (match, key: string) =>
    calendarVariables.some((variable) => variable === key) ? "" : match,
  );
  return !/[{}]/.test(remainder);
}

const template = (max: number) => z.string().max(max).refine(validTemplate);
export const calendarSettingsSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((value) => !/[\r\n\x00-\x1f\x7f]/.test(value)),
  titleTemplate: template(200).refine(
    (value) => value.trim().length > 0 && !/[\x00-\x1f\x7f]/.test(value),
  ),
  descriptionTemplate: template(4000),
  locale: localeSchema,
  listIds: z
    .array(z.string().min(1).max(128))
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length),
});
export type CalendarSettings = z.infer<typeof calendarSettingsSchema>;
export type CalendarFeedView = CalendarSettings & { enabled: boolean; revision: number };

export const calendarCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("save"),
    revision: z.number().int().nonnegative(),
    settings: calendarSettingsSchema,
  }),
  z.strictObject({
    action: z.enum(["enable", "disable", "rotate"]),
    revision: z.number().int().nonnegative(),
  }),
  z.strictObject({ action: z.literal("preview"), settings: calendarSettingsSchema }),
]);
export type CalendarCommand = z.infer<typeof calendarCommandSchema>;

export const calendarResultSchema = z.union([
  z.object({
    feed: calendarSettingsSchema.extend({ enabled: z.boolean(), revision: z.number().int() }),
    url: z.string().url().optional(),
  }),
  z.object({
    preview: z.object({ title: z.string(), description: z.string(), url: z.string() }).nullable(),
  }),
]);
