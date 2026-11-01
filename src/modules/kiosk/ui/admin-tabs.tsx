"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/kiosk", label: "Abrechnung" },
  { href: "/admin/kiosk/entries", label: "Einträge" },
  { href: "/admin/kiosk/cash", label: "Kasse" },
  { href: "/admin/kiosk/products", label: "Sortiment" },
  { href: "/kiosk", label: "Zur Theke" },
];

/** Reiter der Schützenstube-Verwaltung (Pillen, horizontal scrollbar). */
export function KioskAdminTabs() {
  const p = usePathname();
  return (
    <nav aria-label="Schützenstube verwalten" className="animate-fade -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      {TABS.map((t) => {
        const active = t.href === "/admin/kiosk" ? p === t.href : p === t.href || p.startsWith(t.href + "/");
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={cn("press inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium", active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
