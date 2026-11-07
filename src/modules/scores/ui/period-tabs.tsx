import Link from "next/link";
import { PERIODS, type Period } from "@/modules/scores/analytics";
import { cn } from "@/lib/utils";
import { getT, type Locale } from "@/lib/i18n/core";
import { periodTabText } from "./labels";

/** Segment-Umschalter Monat / Jahr / Alle als Links (funktioniert ohne JavaScript). */
export function PeriodTabs({ current, hrefFor, locale = "de" }: { current: Period; hrefFor: Record<Period, string>; locale?: Locale }) {
  const t = getT(locale);
  return (
    <nav aria-label={t("shooting.filters.period")} className="inline-flex rounded-full border border-line bg-surface p-1">
      {PERIODS.map((p) => (
        <Link key={p.key} href={hrefFor[p.key]} scroll={false} aria-current={current === p.key ? "page" : undefined}
          className={cn("press h-9 min-w-16 rounded-full px-3.5 text-sm font-medium inline-flex items-center justify-center transition-colors",
            current === p.key ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2")}>
          {periodTabText(t, p.key, p.label)}
        </Link>
      ))}
    </nav>
  );
}
