"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/components/locale";

const TABS = [
  { href: "/admin/kiosk", label: "adm1.kiosk.tab.billing" },
  { href: "/admin/kiosk/entries", label: "adm1.kiosk.tab.entries" },
  { href: "/admin/kiosk/cash", label: "adm1.kiosk.tab.cash" },
  { href: "/admin/kiosk/products", label: "adm1.kiosk.tab.products" },
  { href: "/kiosk", label: "adm1.kiosk.tab.counter" },
];

/** Reiter der Schützenstube-Verwaltung (Pillen, horizontal scrollbar). */
export function KioskAdminTabs() {
  const t = useT();
  const p = usePathname();
  return (
    <nav aria-label={t("adm1.kiosk.manage")} className="animate-fade -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      {TABS.map((tab) => {
        const active = tab.href === "/admin/kiosk" ? p === tab.href : p === tab.href || p.startsWith(tab.href + "/");
        return (
          <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}
            className={cn("press inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium", active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
            {t(tab.label)}
          </Link>
        );
      })}
    </nav>
  );
}
