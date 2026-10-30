import type { Metadata } from "next";
import { entryReturnPath, withReturnPath } from "@/lib/auth/return-path";
import { getRequestMessages } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { readAdminContact } from "@/lib/admin/contact";
import { getDb } from "@/lib/db";
import { ssoResultMessage } from "@/lib/auth/sso-validation";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRequestMessages()).signIn };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; reauth?: string; sso?: string }>;
}) {
  const params = await searchParams;
  const reauthenticate = params.reauth === "sso";
  const returnTo = reauthenticate ? "/settings#sso-settings" : entryReturnPath(params.returnTo);
  const t = await getRequestMessages();
  const user = await getCurrentUser();
  if (user && !reauthenticate) {
    if (ssoResultMessage(params.sso)) {
      redirect(`/settings?sso=${encodeURIComponent(params.sso ?? "error")}#sso-settings`);
    }
    redirect(user.mustChangePassword ? withReturnPath("/change-password", returnTo) : returnTo);
  }
  const db = await getDb();
  const [adminContact, sso] = await Promise.all([
    readAdminContact(db),
    db.ssoSettings.findUnique({ where: { id: 1 }, select: { enabled: true } }),
  ]);
  return (
    <AuthCard
      title={reauthenticate ? t.ssoReauthenticate : t.welcomeBack}
      description={reauthenticate ? t.ssoReauthRequired : t.signInDescription}
    >
      <LoginForm
        returnTo={returnTo}
        adminContact={adminContact}
        ssoEnabled={!reauthenticate && sso?.enabled}
        initialError={ssoResultMessage(params.sso)}
      />
    </AuthCard>
  );
}
