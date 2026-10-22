import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandIcon } from "@/components/brand-icon";
import { getDb } from "@/lib/db";
import { readImprint } from "@/lib/admin/imprint";
import { getRequestMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRequestMessages()).imprint };
}

export default async function LegalPage() {
  const t = await getRequestMessages();
  const settings = await readImprint(await getDb());
  if (!settings.imprintEnabled) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <nav
        className="mb-8 flex flex-wrap items-center justify-between gap-4 sm:mb-12"
        aria-label={t.imprint}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-3 rounded-xl font-semibold tracking-tight"
        >
          <BrandIcon />
          GradeShelf
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-muted/60 px-4 text-sm font-medium transition-colors hover:bg-accent"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 5-7 7 7 7M5 12h14" />
          </svg>
          {t.home}
        </Link>
      </nav>
      <article className="panel overflow-hidden rounded-3xl" aria-labelledby="legal-heading">
        <header className="space-y-3 border-b border-border/60 bg-muted/20 px-6 py-8 sm:px-10 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t.selfhostedGradeShelf}
          </p>
          <h1 id="legal-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.imprint}
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            {t.imprintPageHelp}
          </p>
        </header>
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="max-w-prose whitespace-pre-wrap break-words text-base leading-8 [overflow-wrap:anywhere]">
            {settings.imprintText}
          </div>
        </div>
      </article>
    </main>
  );
}
