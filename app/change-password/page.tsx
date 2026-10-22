import type { Metadata } from "next";
import { entryReturnPath } from "@/lib/auth/return-path";
import { getRequestMessages } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordForm } from "@/components/auth/password-form";
import { SignOutButton } from "@/components/auth/sign-out-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRequestMessages()).changePassword };
}

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = entryReturnPath((await searchParams).returnTo);
  const t = await getRequestMessages();
  const user = await requireUser({ allowPasswordChange: true });
  if (!user.mustChangePassword) {
    redirect(returnTo === "/dashboard" ? "/settings" : returnTo);
  }
  return (
    <AuthCard title={t.ownPassword} description={t.ownPasswordDescription}>
      <PasswordForm required returnTo={returnTo} />
      <div className="mt-6 pt-5">
        <SignOutButton />
      </div>
    </AuthCard>
  );
}
