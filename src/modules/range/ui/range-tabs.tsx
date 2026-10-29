"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

import type { RangeTab } from "@/modules/range/nav";

/** Navigation innerhalb des Standbetriebs (Pillen, horizontal scrollbar). */
export function RangeTabs({ tabs, label = "Standbetrieb" }: { tabs: RangeTab[]; label?: string }) {
  const p = usePathname();
  const root = tabs[0]?.href;
  return (
    <nav aria-label={label} className="animate-fade -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      {tabs.map((t) => {
        const active = t.href === root ? p === t.href : p === t.href || p.startsWith(t.href + "/");
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("press inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium", active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
