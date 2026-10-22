import Link from "next/link";
import { getRequestMessages } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getRequestMessages();
  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 py-20">
      <h1 className="text-2xl font-semibold">{t.notFound}</h1>
      <p className="text-muted-foreground">{t.notFoundHelp}</p>
      <Link href="/" className="text-primary underline underline-offset-4">
        {t.home}
      </Link>
    </main>
  );
}
