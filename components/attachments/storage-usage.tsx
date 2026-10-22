"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import type { AttachmentLimits } from "@/lib/attachments/rules";
import { useLanguage } from "@/components/i18n/provider";

type StorageState = { limits: AttachmentLimits; usedBytes: number };
const StorageContext = createContext<StorageState | null>(null);

export function AttachmentStorageProvider({
  limits,
  usedBytes,
  children,
}: StorageState & { children: ReactNode }) {
  return <StorageContext value={{ limits, usedBytes }}>{children}</StorageContext>;
}

export function useAttachmentStorage() {
  const value = useContext(StorageContext);
  if (!value) {
    throw new Error("AttachmentStorageProvider is required.");
  }
  return value;
}

export function StorageWarning() {
  const { limits, usedBytes } = useAttachmentStorage();
  const { t } = useLanguage();
  if (!limits.maxUserStorage || usedBytes < limits.maxUserStorage * 0.8) {
    return null;
  }
  return (
    <div
      role="status"
      className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
    >
      <p>{usedBytes >= limits.maxUserStorage ? t.storageFull : t.storageNearlyFull}</p>
      <Link
        href="/settings#storage"
        className="mt-1 inline-block font-medium underline underline-offset-4"
      >
        {t.attachmentStorage}
      </Link>
    </div>
  );
}

export function StorageUsage({ compact = false }: { compact?: boolean }) {
  const { limits, usedBytes } = useAttachmentStorage();
  const { t, locale } = useLanguage();
  const limit = limits.maxUserStorage;
  const percent = limit > 0 ? Math.min(100, (usedBytes / limit) * 100) : 0;
  const formatBytes = (bytes: number) => {
    const inGiB = bytes >= 1024 ** 3;
    const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
      bytes / 1024 ** (inGiB ? 3 : 2),
    );
    return `${value} ${inGiB ? "GiB" : "MiB"}`;
  };
  const summary = limit
    ? t.storageUsedOf
        .replace("{used}", formatBytes(usedBytes))
        .replace("{limit}", formatBytes(limit))
    : t.storageUsedUnlimited.replace("{used}", formatBytes(usedBytes));
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{summary}</p>
      {limit > 0 && (
        <div
          role="progressbar"
          aria-label={t.attachmentStorage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          aria-valuetext={summary}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={`h-full rounded-full ${percent >= 80 ? "bg-amber-500" : "bg-primary"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {!compact && <p className="text-xs text-muted-foreground">{t.storageHelp}</p>}
    </div>
  );
}
