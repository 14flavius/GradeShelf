"use client";

import { useLanguage } from "@/components/i18n/provider";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ retry }: { retry: () => void }) {
  const { t } = useLanguage();
  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 py-20">
      <h1 className="text-2xl font-semibold">{t.unavailable}</h1>
      <p className="text-muted-foreground">{t.unavailableHelp}</p>
      <Button onClick={retry}>{t.retry}</Button>
    </main>
  );
}
