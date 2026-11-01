"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/bookings", label: "Übersicht" },
  { href: "/admin/bookings/calendar", label: "Kalender" },
  { href: "/admin/bookings/resources", label: "Ressourcen" },
  { href: "/admin/bookings/partners", label: "Partnervereine" },
  { href: "/admin/bookings/settings", label: "Einstellungen" },
  { href: "/admin/bookings/payments", label: "Zahlungsanbieter" },
];

export function AdminBookingTabs() {
  const p = usePathname();
  return (
    <div className="animate-fade flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 mb-4 [scrollbar-width:none]">
      {TABS.map((t) => {
        const active = t.href === "/admin/bookings" ? p === t.href : p.startsWith(t.href);
        return <Link key={t.href} href={t.href} className={cn("press shrink-0 h-9 rounded-full px-3.5 text-sm font-medium border", active ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2")}>{t.label}</Link>;
      })}
    </div>
  );
}
