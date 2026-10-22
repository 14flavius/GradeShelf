import { getRequestMessages } from "@/lib/i18n/server";
import { author, homepage, repository, version } from "@/package.json";
import Link from "next/link";
import { getDb } from "@/lib/db";

export async function SiteFooter() {
  const t = await getRequestMessages();
  const db = await getDb();
  const settings = await db.siteSettings.findUnique({
    where: { id: 1 },
    select: { imprintEnabled: true, instanceName: true },
  });
  const linkClass =
    "inline-flex min-h-11 items-center rounded-sm transition-colors hover:text-foreground focus-visible:text-foreground";

  return (
    <footer
      aria-label={t.projectInformation}
      className="shrink-0 border-t border-border/60 text-xs text-muted-foreground print:hidden"
    >
      <div className="mx-auto grid max-w-6xl items-center justify-items-center gap-x-6 gap-y-1 px-5 py-3 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)]">
        <div className="flex items-center gap-3 lg:justify-self-start">
          <a
            href={homepage}
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkClass} font-semibold`}
          >
            {t.selfhostedGradeShelf}
          </a>
          <span
            aria-label={`${t.version} ${version}`}
            className="rounded-md bg-muted/60 px-2 py-1 tabular-nums"
          >
            v{version}
          </span>
        </div>
        <p className="max-w-64 break-words py-2 text-center font-medium text-foreground [overflow-wrap:anywhere]">
          {settings?.instanceName}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 lg:justify-self-end">
          {settings?.imprintEnabled && (
            <Link href="/legal" className={linkClass}>
              {t.imprint}
            </Link>
          )}
          <span className="inline-flex flex-wrap items-center justify-center gap-x-1">
            {t.createdBy}{" "}
            <a href={author.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {author.name}
            </a>
          </span>
          <a href={repository.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
