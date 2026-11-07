import Link from "next/link";
import { Languages } from "lucide-react";
import { getT, LOCALE_LABELS, type Locale } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";

/**
 * Hinweis über einem übersetzten Inhalt mit Umschalter (Link, ohne JavaScript):
 * «Automatisch übersetzt · Original anzeigen» bzw. «Original (Deutsch) · Übersetzung anzeigen».
 */
export function TranslatedNote({ locale, sourceLocale, showingOriginal, reviewed, toggleHref, className }: {
  locale: Locale;
  sourceLocale: Locale;
  showingOriginal: boolean;
  reviewed: boolean;
  toggleHref: string;
  className?: string;
}) {
  const t = getT(locale);
  return (
    <p className={cn("flex flex-wrap items-center gap-x-1.5 text-xs text-ink-3", className)}>
      <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{showingOriginal ? t("aicontent.view.original", { lang: LOCALE_LABELS[sourceLocale] }) : t(reviewed ? "aicontent.view.translated" : "aicontent.view.auto")}</span>
      <span aria-hidden>·</span>
      <Link href={toggleHref} scroll={false} replace className="inline-flex min-h-11 items-center font-medium text-accent underline-offset-2 hover:underline">
        {showingOriginal ? t("aicontent.view.showTranslation") : t("aicontent.view.showOriginal")}
      </Link>
    </p>
  );
}
