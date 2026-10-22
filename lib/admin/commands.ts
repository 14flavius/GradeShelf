import { z } from "zod";
import { passwordSchema, usernameSchema } from "../auth/validation.ts";

const id = z.string().min(1).max(128);
export const adminCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      username: usernameSchema,
      password: passwordSchema,
      role: z.enum(["USER", "ADMIN"]),
      mustChangePassword: z.boolean().default(true),
    })
    .strict(),
  z.object({ action: z.literal("setActive"), id, active: z.boolean() }).strict(),
  z.object({ action: z.literal("setUsername"), id, username: usernameSchema }).strict(),
  z.object({ action: z.literal("setPassword"), id, password: passwordSchema }).strict(),
  z.object({ action: z.literal("forcePasswordChange"), id }).strict(),
  z.object({ action: z.literal("resetTwoFactor"), id }).strict(),
  z.object({ action: z.literal("delete"), id, confirmation: z.string().min(1).max(128) }).strict(),
]);
export type AdminCommand = z.infer<typeof adminCommandSchema>;
export type AdminUserView = {
  id: string;
  username: string | null;
  role: "USER" | "ADMIN";
  isActive: boolean;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
  createdAt: string;
};
