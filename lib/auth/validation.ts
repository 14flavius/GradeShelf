import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(32)
  .regex(
    /^[a-z0-9][a-z0-9._-]*$/,
    "3–32 Zeichen: Buchstaben, Zahlen, Punkt, Bindestrich oder Unterstrich.",
  );
export const passwordSchema = z.string().min(12, "Mindestens 12 Zeichen verwenden.").max(128);
export const displayNameSchema = z
  .string()
  .trim()
  .max(80)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value));
const currentPassword = z.string().min(1).max(128);
const changePasswordSchema = z
  .object({
    currentPassword,
    newPassword: passwordSchema,
    revokeOtherSessions: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Das neue Passwort muss sich vom bisherigen unterscheiden.",
  });

export const authBodies = {
  "/sign-in/username": z
    .object({
      username: usernameSchema,
      password: currentPassword,
      rememberMe: z.boolean().optional(),
    })
    .strict(),
  "/change-password": changePasswordSchema,
  "/update-user": z.object({ name: displayNameSchema }).strict(),
  "/two-factor/enable": z
    .object({ password: currentPassword, method: z.literal("totp").optional() })
    .strict(),
  "/two-factor/disable": z.object({ password: currentPassword }).strict(),
  "/two-factor/generate-backup-codes": z.object({ password: currentPassword }).strict(),
  "/two-factor/verify-totp": z
    .object({ code: z.string().regex(/^\d{6}$/), trustDevice: z.literal(false).optional() })
    .strict(),
  "/two-factor/verify-backup-code": z
    .object({ code: z.string().trim().min(1).max(64), trustDevice: z.literal(false).optional() })
    .strict(),
} satisfies Record<string, z.ZodType>;

export const exposedAuthPaths = new Set(["/get-session", "/sign-out", ...Object.keys(authBodies)]);
