"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getT, type Locale } from "@/lib/i18n/core";

import type { RangeTab } from "@/modules/range/nav";

/**
 * Navigation innerhalb des Standbetriebs (Pillen, horizontal scrollbar).
 * Mit `locale` werden die Mitglieder-Reiter übersetzt (Schlüssel «shooting.range.tab.<href>»),
 * sonst und für unbekannte Reiter gilt die deutsche Bezeichnung.
 */
export function RangeTabs({ tabs, label, locale }: { tabs: RangeTab[]; label?: string; locale?: Locale }) {
  const p = usePathname();
  const t = getT(locale ?? "de");
  const tabLabel = (tab: RangeTab) => {
    if (!locale) return tab.label;
    const key = `shooting.range.tab.${tab.href}`;
    const v = t(key);
    return v === key ? tab.label : v;
  };
  const root = tabs[0]?.href;
  return (
    <nav aria-label={label ?? t("shooting.range.nav")} className="animate-fade -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      {tabs.map((tab) => {
        const active = tab.href === root ? p === tab.href : p === tab.href || p.startsWith(tab.href + "/");
        return (
          <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined} className={cn("press inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium", active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
            {tabLabel(tab)}
          </Link>
        );
      })}
    </nav>
  );
}
