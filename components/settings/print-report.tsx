"use client";

import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";

export function PrintReport() {
  const { t } = useLanguage();
  return <Button onClick={() => window.print()}>{t.pdfSave}</Button>;
}
