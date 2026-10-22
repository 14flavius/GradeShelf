"use client";

import { createContext, useContext, type ReactNode } from "react";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { messages } from "@/lib/i18n/messages";

const LocaleContext = createContext<Locale>(defaultLocale);

export function LanguageProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLanguage() {
  const locale = useContext(LocaleContext);
  return { locale, t: messages[locale] };
}
