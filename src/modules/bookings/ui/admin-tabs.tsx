"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/locale";
import { cn } from "@/lib/utils";

/** Reiter der Reservations-Verwaltung; `label` ist ein Wörterbuch-Schlüssel. */
const TABS = [
  { href: "/admin/bookings", label: "adm1.bk.tab.overview" },
  { href: "/admin/bookings/calendar", label: "adm1.bk.tab.calendar" },
  { href: "/admin/bookings/resources", label: "adm1.bk.tab.resources" },
  { href: "/bookings/series", label: "adm1.bk.tab.series" },
  { href: "/admin/bookings/partners", label: "adm1.bk.tab.partners" },
  { href: "/admin/bookings/settings", label: "adm1.bk.tab.settings" },
  { href: "/admin/bookings/payments", label: "adm1.bk.tab.payments" },
];

export function AdminBookingTabs() {
  const p = usePathname();
  const t = useT();
  return (
    <div className="animate-fade flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 mb-4 [scrollbar-width:none]">
      {TABS.map((tab) => {
        const active = tab.href === "/admin/bookings" ? p === tab.href : p.startsWith(tab.href);
        return <Link key={tab.href} href={tab.href} className={cn("press shrink-0 inline-flex h-11 items-center rounded-full px-3.5 text-sm font-medium border", active ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2")}>{t(tab.label)}</Link>;
      })}
    </div>
  );
}
