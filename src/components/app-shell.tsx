"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, Crosshair, Menu, CalendarDays, CreditCard, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import type { ModuleKey } from "@/lib/modules";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; module?: ModuleKey };

const NAV: NavItem[] = [
  { href: "/", label: "Start", icon: Home },
  { href: "/scores", label: "Schiessen", icon: Crosshair, module: "scores" },
  { href: "/targets", label: "Scheiben", icon: Target, module: "targets" },
  { href: "/events", label: "Anlässe", icon: Megaphone, module: "events" },
  { href: "/bookings", label: "Buchen", icon: CalendarDays, module: "bookings" },
  { href: "/billing", label: "Beiträge", icon: CreditCard, module: "billing" },
  { href: "/me", label: "Mehr", icon: Menu },
];

export function AppShell({ children, enabledModules, tenantName, userInitials }: { children: React.ReactNode; enabledModules: ModuleKey[]; tenantName: string | null; userInitials: string }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => !n.module || enabledModules.includes(n.module));
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop-Seitenleiste */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-line md:bg-surface md:sticky md:top-0 md:h-dvh">
        <Link href="/" className="flex items-center gap-2 px-5 h-16 font-semibold tracking-tight">
          <Logo /> Standchef
        </Link>
        {tenantName ? <div className="px-5 pb-3 text-xs text-ink-3 truncate">{tenantName}</div> : null}
        <nav className="px-3 space-y-0.5">
          {items.map((n) => (
            <Link key={n.href} href={n.href}
              className={cn("flex items-center gap-3 rounded-control px-3 h-11 text-[15px] font-medium transition-colors", isActive(n.href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2")}>
              <n.icon className="h-5 w-5" /> {n.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile-Kopfzeile */}
        <header className="md:hidden sticky top-0 z-20 bg-bg/80 backdrop-blur border-b border-line">
          <div className="flex items-center justify-between h-14 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight"><Logo size={24} /> Standchef</Link>
            <Link href="/me" className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">{userInitials}</Link>
          </div>
        </header>

        <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-5 pb-28 md:pb-10 md:px-8">{children}</main>

        {/* Mobile-Tableiste */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-line bg-surface/95 backdrop-blur safe-bottom">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
            {items.map((n) => {
              const active = isActive(n.href);
              return (
                <Link key={n.href} href={n.href} className="press flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium">
                  <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", active ? "bg-ink text-bg" : "text-ink-3")}>
                    <n.icon className="h-5 w-5" />
                  </span>
                  <span className={active ? "text-ink" : "text-ink-3"}>{n.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
