import Link from "next/link";
import { cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/core";

/**
 * Tabs als Links (z.B. Filter über Suchparameter). Serverseitig nutzbar,
 * aktiver Eintrag über `active` (value).
 *   <LinkTabs active={sp.status ?? "all"} locale={locale} items={[{ value: "all", href: "?", label: "Alle" }, …]} />
 * `label` ist die Beschriftung für Screenreader; ohne Angabe «Ansicht wählen» in der Sprache `locale`
 * (Standard Deutsch).
 */
export function LinkTabs({ items, active, label, locale, className }: { items: Array<{ value: string; href: string; label: React.ReactNode; count?: number }>; active: string; label?: string; locale?: string | null; className?: string }) {
  const ariaLabel = label ?? getT(locale)("shell.ui.chooseView");
  return (
    <nav aria-label={ariaLabel} className={cn("-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1", className)}>
      {items.map((t) => {
        const on = t.value === active;
        return (
          <Link
            key={t.value}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative -mb-px inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent",
              on ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {t.label}
            {typeof t.count === "number" ? <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-3")}>{t.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
