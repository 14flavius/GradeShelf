import type { ReactNode } from "react";
import { getRequestMessages } from "@/lib/i18n/server";
import Link from "next/link";
import type { getCurrentUser } from "@/lib/auth/server";
import { AppNavigation } from "@/components/app-navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandIcon } from "@/components/brand-icon";
import { RefreshButton } from "@/components/refresh-button";
import { getDb } from "@/lib/db";
import { getAttachmentLimits } from "@/lib/attachments/config";
import { attachmentUsage } from "@/lib/attachments/usage";
import { AttachmentStorageProvider, StorageWarning } from "@/components/attachments/storage-usage";

const mainContentId = "main";

export async function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
}) {
  const t = await getRequestMessages();
  const usedBytes = await attachmentUsage(await getDb(), user.id);
  return (
    <AttachmentStorageProvider limits={getAttachmentLimits()} usedBytes={usedBytes}>
      <div className="flex-1">
        <a
          href={`#${mainContentId}`}
          className="sr-only focus:not-sr-only focus:absolute focus:m-4 focus:bg-card focus:p-3"
        >
          {t.skipContent}
        </a>
        <header className="bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <Link href="/dashboard" className="flex items-center gap-3 text-lg font-semibold">
              <BrandIcon />
              GradeShelf
            </Link>
            <div className="order-2 ml-auto flex min-w-0 items-center gap-4 lg:order-3 lg:ml-0 lg:justify-self-end">
              <span className="hidden max-w-32 truncate sm:inline text-sm text-muted-foreground">
                {user.username}
              </span>
              <RefreshButton />
              <SignOutButton />
            </div>
            <AppNavigation isAdmin={user.role === "ADMIN"} />
          </div>
        </header>
        <main
          id={mainContentId}
          tabIndex={-1}
          className="mx-auto max-w-6xl px-5 py-6 outline-none sm:px-8 sm:py-8"
        >
          <StorageWarning />
          {children}
        </main>
      </div>
    </AttachmentStorageProvider>
  );
}
