"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/components/locale";

const TABS = [
  { href: "/admin/ammo", label: "adm1.ammo.tab.orders" },
  { href: "/admin/ammo/counter", label: "adm1.ammo.tab.counter" },
  { href: "/admin/ammo/products", label: "adm1.ammo.tab.products" },
  { href: "/admin/ammo/stock", label: "adm1.ammo.tab.stock" },
  { href: "/admin/ammo/settings", label: "adm1.ammo.tab.settings" },
];

export function AdminAmmoTabs() {
  const p = usePathname();
  const tr = useT();
  return (
    <nav aria-label={tr("adm1.ammo.manage")} className="animate-fade -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      {TABS.map((t) => {
        const active = t.href === "/admin/ammo" ? p === t.href || p.startsWith("/admin/ammo/orders") : p.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("press inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium", active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
            {tr(t.label)}
          </Link>
        );
      })}
    </nav>
  );
}
