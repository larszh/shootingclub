"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/billing", label: "Übersicht", billingOnly: true },
  { href: "/admin/billing/members", label: "Mitglieder", billingOnly: true },
  { href: "/admin/billing/categories", label: "Kategorien", billingOnly: true },
  { href: "/admin/billing/import", label: "Bankimport", billingOnly: false },
  { href: "/admin/billing/settings", label: "Rechnungsprofil", billingOnly: false },
];

/**
 * Reiter der Beitragsverwaltung. Ohne aktives Modul «Mitgliederbeiträge» (`billing={false}`) bleiben nur
 * Bankimport und Rechnungsprofil; die übrigen Seiten wären gesperrt.
 */
export function AdminBillingTabs({ billing = true }: { billing?: boolean }) {
  const p = usePathname();
  const tabs = billing ? TABS : TABS.filter((t) => !t.billingOnly);
  return (
    <div className="animate-fade flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 mb-4 [scrollbar-width:none]">
      {tabs.map((t) => {
        const active = t.href === "/admin/billing" ? p === t.href || p.startsWith("/admin/billing/runs") : p.startsWith(t.href);
        return <Link key={t.href} href={t.href} className={cn("press shrink-0 h-9 rounded-full px-3.5 text-sm font-medium border", active ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2")}>{t.label}</Link>;
      })}
    </div>
  );
}
