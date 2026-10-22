import type { Metadata } from "next";
import { entryReturnPath } from "@/lib/auth/return-path";
import { getRequestMessages } from "@/lib/i18n/server";
import { AuthCard } from "@/components/auth/auth-card";
import { SecondFactorForm } from "@/components/auth/second-factor-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRequestMessages()).confirmSignIn };
}

export default async function VerifyTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = entryReturnPath((await searchParams).returnTo);
  const t = await getRequestMessages();
  return (
    <AuthCard title={t.confirmSignIn} description={t.confirmDescription}>
      <SecondFactorForm returnTo={returnTo} />
    </AuthCard>
  );
}
