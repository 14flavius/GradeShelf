"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/i18n/provider";

export function AppNavigation({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const links = [
    { href: "/dashboard", label: t.dashboard },
    { href: "/lists", label: t.lists },
    { href: "/settings", label: t.settings },
    ...(isAdmin ? [{ href: "/admin", label: t.admin }] : []),
  ];
  return (
    <nav
      aria-label={t.navigation}
      className="order-3 flex w-full flex-wrap justify-center gap-1 text-xs sm:text-sm lg:order-2 lg:w-auto"
    >
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative inline-flex min-h-10 items-center rounded-md px-2 py-2 font-medium sm:px-3 transition-colors duration-200 ${active ? "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary sm:after:inset-x-3" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
