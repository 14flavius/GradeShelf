import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/server";
import { AppShell } from "@/components/app-shell";
import { SessionRefresh } from "@/components/auth/session-refresh";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell user={await requireUser()}>
      <SessionRefresh />
      {children}
    </AppShell>
  );
}
