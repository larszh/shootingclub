import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { NotFoundView } from "@/components/ui/not-found-view";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.notFound.metaTitle") };
}

export default async function NotFound() {
  const t = getT(await getRequestLocale());
  return (
    <div className="min-h-dvh">
      <div className="flex justify-center pt-10">
        <Link href="/" aria-label={t("shell.common.homeAria")} className="inline-flex items-center gap-2 font-semibold tracking-tight">
          <Logo size={32} /> Standchef
        </Link>
      </div>
      <NotFoundView />
    </div>
  );
}
