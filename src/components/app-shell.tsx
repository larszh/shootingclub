"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, Crosshair, Menu, CalendarDays, CreditCard, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { TenantLogo } from "@/components/logo";
import { Avatar } from "@/components/avatar";
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

export type ShellTenant = { id: string; name: string; logoUrl: string | null };
export type ShellUser = { name: string; email: string; avatarUrl: string | null };

export function AppShell({
  children,
  enabledModules,
  tenant,
  user,
}: {
  children: React.ReactNode;
  enabledModules: ModuleKey[];
  tenant: ShellTenant | null;
  user: ShellUser;
}) {
  const pathname = usePathname();
  const items = NAV.filter((n) => !n.module || enabledModules.includes(n.module));
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const title = tenant?.name ?? "Standchef";

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop-Seitenleiste */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-line md:bg-surface md:sticky md:top-0 md:h-dvh">
        <Link href="/" className="flex items-center gap-3 px-5 h-18 min-h-16 py-3 group" title={title}>
          <TenantLogo src={tenant?.logoUrl} size={36} />
          <span className="min-w-0">
            <span className="block font-semibold tracking-tight leading-tight truncate">{title}</span>
            {tenant ? <span className="block text-[11px] text-ink-3 leading-tight">mit Standchef</span> : null}
          </span>
        </Link>
        <div className="mx-5 mb-3 h-0.5 rounded-full brand-gradient opacity-80" aria-hidden />
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto" aria-label="Hauptnavigation">
          {items.map((n) => {
            const active = isActive(n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-3 rounded-control px-3 h-11 text-[15px] font-medium transition-colors", active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2")}>
                <n.icon className="h-5 w-5" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/me" className={cn("m-3 flex items-center gap-3 rounded-control px-3 py-2.5 transition-colors", isActive("/me") ? "bg-surface-2" : "hover:bg-surface-2")}>
          <Avatar name={user.name} src={user.avatarUrl} size={36} />
          <span className="min-w-0">
            <span className="block text-sm font-medium truncate">{user.name}</span>
            <span className="block text-xs text-ink-3 truncate">{user.email}</span>
          </span>
        </Link>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile-Kopfzeile */}
        <header className="md:hidden sticky top-0 z-20 bg-bg/85 backdrop-blur border-b border-line safe-top">
          <div className="flex items-center justify-between gap-3 h-14 px-4">
            <Link href="/" className="flex min-w-0 items-center gap-2.5 font-semibold tracking-tight">
              <TenantLogo src={tenant?.logoUrl} size={28} />
              <span className="truncate">{title}</span>
            </Link>
            <Link href="/me" className="press shrink-0 rounded-full ring-2 ring-transparent focus-visible:ring-accent" aria-label="Profil und Einstellungen">
              <Avatar name={user.name} src={user.avatarUrl} size={36} />
            </Link>
          </div>
        </header>

        <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-5 pb-28 md:pb-10 md:px-8">{children}</main>

        {/* Mobile-Tableiste */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-line bg-surface/95 backdrop-blur safe-bottom" aria-label="Hauptnavigation">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
            {items.map((n) => {
              const active = isActive(n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className="press flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium min-w-0">
                  <span className={cn("flex h-8 w-full max-w-14 items-center justify-center rounded-full transition-colors", active ? "bg-accent text-accent-ink" : "text-ink-3")}>
                    <n.icon className="h-5 w-5" />
                  </span>
                  <span className={cn("truncate max-w-full px-0.5", active ? "text-ink" : "text-ink-3")}>{n.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
