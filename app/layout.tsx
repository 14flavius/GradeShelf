import { getDb } from "@/lib/db";
import { readInstanceName } from "@/lib/admin/instance";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { localSignInURL } from "@/lib/auth/local-origin";
import { getRequestLocale, getRequestMessages } from "@/lib/i18n/server";
import { LanguageProvider } from "@/components/i18n/provider";
import { SiteFooter } from "@/components/site-footer";
import { author } from "@/package.json";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestMessages();
  const name = (await readInstanceName(await getDb())) || "GradeShelf";
  return {
    title: { default: name, template: `%s · ${name}` },
    description: t.description,
    robots: { index: false, follow: false },
    applicationName: "GradeShelf",
    authors: [author],
    creator: author.name,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3d5bc2",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const target = localSignInURL((await headers()).get("host"), process.env.BETTER_AUTH_URL);
  if (target) {
    redirect(target.href);
  }
  const locale = await getRequestLocale();
  return (
    <html lang={locale} data-theme="system" suppressHydrationWarning className="h-full antialiased">
      <head>
        {/* Safari must see installation metadata before async metadata is streamed. */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="GradeShelf" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link
          rel="apple-touch-icon"
          type="image/png"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
      </head>
      <body className="flex min-h-svh flex-col print:block print:min-h-0">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <LanguageProvider locale={locale}>
          <div className="flex flex-1 flex-col print:block">{children}</div>
          <SiteFooter />
        </LanguageProvider>
      </body>
    </html>
  );
}
