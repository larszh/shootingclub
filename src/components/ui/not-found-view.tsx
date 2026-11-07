import Link from "next/link";
import { HelpCircle, Home } from "lucide-react";
import { buttonClasses } from "./index";
import { SearchIllustration } from "./illustrations";
import { getRequestLocale, getT } from "@/lib/i18n";

/** Freundliche «nicht gefunden»-Ansicht (serverseitig, in der Sprache des Requests). */
export async function NotFoundView({ compact }: { compact?: boolean }) {
  const t = getT(await getRequestLocale());
  return (
    <div className={compact ? "py-6" : "flex min-h-[60dvh] items-center justify-center px-4 py-10"}>
      <div className="animate-rise mx-auto w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex justify-center">
          <SearchIllustration size={112} />
        </div>
        <p className="text-sm font-semibold tabular-nums text-accent">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("shell.notFound.title")}</h1>
        <p className="mt-2 text-[15px] text-ink-2">
          {t("shell.notFound.text")}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/" className={buttonClasses("primary", "lg")}>
            <Home className="h-4 w-4" aria-hidden /> {t("shell.common.toHome")}
          </Link>
          <Link href="/help" className={buttonClasses("secondary", "lg")}>
            <HelpCircle className="h-4 w-4" aria-hidden /> {t("shell.common.help")}
          </Link>
        </div>
      </div>
    </div>
  );
}
