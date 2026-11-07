"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/components/locale";

const TABS = [
  { href: "/admin/billing", label: "adm1.common.overview", billingOnly: true },
  { href: "/admin/billing/members", label: "adm1.members.title", billingOnly: true },
  { href: "/admin/billing/invoices", label: "adm1.bill.tab.invoices", billingOnly: true },
  { href: "/admin/billing/categories", label: "adm1.bill.tab.categories", billingOnly: true },
  { href: "/admin/billing/import", label: "adm1.bill.tab.import", billingOnly: false },
  { href: "/admin/billing/settings", label: "adm1.bill.tab.profile", billingOnly: false },
];

/**
 * Reiter der Beitragsverwaltung. Ohne aktives Modul «Mitgliederbeiträge» (`billing={false}`) bleiben nur
 * Bankimport und Rechnungsprofil; die übrigen Seiten wären gesperrt.
 */
export function AdminBillingTabs({ billing = true }: { billing?: boolean }) {
  const t = useT();
  const p = usePathname();
  const tabs = billing ? TABS : TABS.filter((x) => !x.billingOnly);
  return (
    <div className="animate-fade flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 mb-4 [scrollbar-width:none]">
      {tabs.map((tab) => {
        const active = tab.href === "/admin/billing" ? p === tab.href || p.startsWith("/admin/billing/runs") : p.startsWith(tab.href);
        return <Link key={tab.href} href={tab.href} className={cn("press shrink-0 h-9 rounded-full px-3.5 text-sm font-medium border", active ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2")}>{t(tab.label)}</Link>;
      })}
    </div>
  );
}
