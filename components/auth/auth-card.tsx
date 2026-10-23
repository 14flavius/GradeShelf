import type { ReactNode } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { BrandIcon } from "@/components/brand-icon";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
      <div className="auth-content w-full max-w-md space-y-7">
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-lg text-2xl font-semibold tracking-tight"
          >
            <BrandIcon size={44} />
            GradeShelf
          </Link>
        </div>
        <section
          className="panel space-y-6 overflow-hidden rounded-3xl"
          aria-labelledby="auth-heading"
        >
          <header className="space-y-2 px-6 pt-8 text-center sm:px-8">
            <h1 id="auth-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="mx-auto max-w-xs text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </header>
          <div className="px-6 sm:px-8">{children}</div>
          <footer className="grid grid-cols-2 items-start gap-4 bg-muted/30 px-6 py-5 sm:px-8">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </footer>
        </section>
      </div>
    </main>
  );
}
