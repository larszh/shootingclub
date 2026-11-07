"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/components/locale";

export function AdminEventTabs({ showAnnouncements }: { showAnnouncements: boolean }) {
  const p = usePathname();
  const tr = useT();
  const tabs = [
    { href: "/admin/events", label: tr("money.events.title"), active: p === "/admin/events" || (p.startsWith("/admin/events/") && !p.startsWith("/admin/events/announcements")) },
    ...(showAnnouncements ? [{ href: "/admin/events/announcements", label: tr("misc.events.announcements"), active: p.startsWith("/admin/events/announcements") }] : []),
  ];
  return (
    <div className="animate-fade -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined}
          className={cn("press h-11 shrink-0 rounded-full border px-3.5 text-sm font-medium leading-[2.75rem]", t.active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
