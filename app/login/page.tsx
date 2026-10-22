import type { Metadata } from "next";
import { entryReturnPath, withReturnPath } from "@/lib/auth/return-path";
import { getRequestMessages } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { readAdminContact } from "@/lib/admin/contact";
import { getDb } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRequestMessages()).signIn };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = entryReturnPath((await searchParams).returnTo);
  const t = await getRequestMessages();
  const user = await getCurrentUser();
  if (user) {
    redirect(user.mustChangePassword ? withReturnPath("/change-password", returnTo) : returnTo);
  }
  const adminContact = await readAdminContact(await getDb());
  return (
    <AuthCard title={t.welcomeBack} description={t.signInDescription}>
      <LoginForm returnTo={returnTo} adminContact={adminContact} />
    </AuthCard>
  );
}
