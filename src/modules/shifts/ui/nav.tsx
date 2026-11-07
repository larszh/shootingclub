"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/components/locale";

/** Reiter; `label` ist ein Wörterbuch-Schlüssel. */
export const ADMIN_SHIFT_TABS = [
  { href: "/admin/shifts", label: "adm2.shifts.tab.shifts" },
  { href: "/admin/shifts/hours", label: "adm2.shifts.tab.hours" },
  { href: "/admin/shifts/settings", label: "adm2.common.settings" },
  { href: "/admin/qualifications", label: "adm2.shifts.tab.quals" },
];

/** Reiter der Einsatzplanung (Pillen, horizontal scrollbar). */
export function ShiftAdminTabs({ badges }: { badges?: Record<string, number> }) {
  const p = usePathname();
  const tr = useT();
  return (
    <nav aria-label={tr("adm2.shifts.tab.aria")} className="animate-fade -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      {ADMIN_SHIFT_TABS.map((t) => {
        const active = t.href === "/admin/shifts" ? p === t.href || (p.startsWith("/admin/shifts/") && !ADMIN_SHIFT_TABS.some((o) => o.href !== t.href && p.startsWith(o.href))) : p === t.href || p.startsWith(t.href + "/");
        const n = badges?.[t.href];
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={cn("press inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium", active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
            {tr(t.label)}
            {n ? <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-bg/20" : "bg-warn/15 text-warn")}>{n}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
