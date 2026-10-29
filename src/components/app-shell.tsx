"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, Crosshair, Menu, CalendarDays, Megaphone, MessageCircle, FolderOpen, Package, Wallet, Settings, Users, FileUp, House, History, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { TenantLogo } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import type { ModuleKey } from "@/lib/modules";
import { ChatUnreadBadge } from "@/modules/chat/ui/chat-unread-badge";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Sichtbar, wenn mindestens eines dieser Module aktiv ist (leer = immer) */
  modules?: ModuleKey[];
  /** Weitere Pfade, unter denen der Eintrag als aktiv gilt */
  alsoActive?: string[];
};

/**
 * Reihenfolge = Priorität. Mobil passen nur die ersten vier aktiven Einträge plus «Mehr» in die
 * Tableiste, darum zuerst, was man am Stand und unterwegs am häufigsten braucht:
 *   Start → Schiessen (Kernfunktion am Stand) → Chat (täglich, mit Ungelesen-Zähler)
 *   → Anlässe (Termine, An-/Abmeldung) → Buchen (Reservationen).
 * Seltener genutzte Bereiche (Scheiben drucken, Dateien, Munition, Zahlungen) folgen danach und
 * sind mobil unter «Mehr» erreichbar, auf dem Desktop immer in der Seitenleiste.
 * «Zahlungen» bündelt Beiträge, Reservations- und Munitionsrechnungen und ersetzt den früheren
 * Eintrag «Beiträge» (der unter «Mehr» weiterhin direkt erreichbar ist).
 */
const NAV: NavItem[] = [
  { href: "/", label: "Start", icon: Home },
  { href: "/scores", label: "Schiessen", icon: Crosshair, modules: ["scores"] },
  { href: "/chat", label: "Chat", icon: MessageCircle, modules: ["chat"] },
  { href: "/events", label: "Anlässe", icon: Megaphone, modules: ["events"] },
  { href: "/bookings", label: "Buchen", icon: CalendarDays, modules: ["bookings"] },
  { href: "/targets", label: "Scheiben", icon: Target, modules: ["targets"] },
  { href: "/files", label: "Dateien", icon: FolderOpen, modules: ["files"] },
  { href: "/ammo", label: "Munition", icon: Package, modules: ["ammo"] },
  { href: "/payments", label: "Zahlungen", icon: Wallet, modules: ["billing", "bookings", "ammo"], alsoActive: ["/billing"] },
  // Verwaltung und Verzeichnis liegen mobil unter «Mehr» (Tableiste bleibt bei 5 Einträgen).
  { href: "/me", label: "Mehr", icon: Menu, alsoActive: ["/admin", "/members", "/super", "/help"] },
];

export type ShellTenant = { id: string; name: string; logoUrl: string | null };
/** Welche Verwaltungslinks die Desktop-Seitenleiste zeigt (aus den Berechtigungen im Layout). */
export type ShellAdmin = {
  settings?: boolean; // tenant.manage
  members?: boolean; // members.view
  membersManage?: boolean; // members.manage: Import, Haushalte
  audit?: boolean; // audit.view
  system?: boolean; // Super-Admin
};

function adminLinks(a: ShellAdmin | null | undefined): NavItem[] {
  if (!a) return [];
  const out: NavItem[] = [];
  if (a.settings) out.push({ href: "/admin", label: "Einstellungen", icon: Settings });
  if (a.members) out.push({ href: "/admin/members", label: "Mitglieder", icon: Users });
  if (a.membersManage) {
    out.push({ href: "/admin/members/import", label: "Import", icon: FileUp });
    out.push({ href: "/admin/members/households", label: "Haushalte", icon: House });
  }
  if (a.audit) out.push({ href: "/admin/audit", label: "Protokoll", icon: History });
  if (a.system) out.push({ href: "/super/system", label: "System", icon: Server });
  return out;
}
export type ShellUser = { name: string; email: string; avatarUrl: string | null };

export function AppShell({
  children,
  enabledModules,
  tenant,
  user,
  chatUnread = null,
  admin = null,
}: {
  children: React.ReactNode;
  enabledModules: ModuleKey[];
  tenant: ShellTenant | null;
  user: ShellUser;
  /** Ungelesene Chat-Nachrichten beim Laden (null = Chat nicht aktiv) */
  chatUnread?: number | null;
  /** Verwaltungslinks für die Desktop-Seitenleiste (mobil unter «Mehr» → /me) */
  admin?: ShellAdmin | null;
}) {
  const pathname = usePathname();
  const items = NAV.filter((n) => !n.modules || n.modules.some((m) => enabledModules.includes(m)));
  const matches = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const isActive = (href: string) => matches(href) || (NAV.find((n) => n.href === href)?.alsoActive ?? []).some(matches);
  // Tableiste: höchstens 5 Einträge, sonst werden die Beschriftungen auf schmalen Geräten abgeschnitten.
  // Überzählige Module sind unter «Mehr» erreichbar (Liste auf /me und Desktop-Seitenleiste).
  const MAX_TABS = 5;
  const tabs = items.length > MAX_TABS ? [...items.filter((n) => n.href !== "/me").slice(0, MAX_TABS - 1), items.find((n) => n.href === "/me")!] : items;
  const overflowActive = tabs.length < items.length && items.some((n) => !tabs.includes(n) && isActive(n.href));
  const isTabActive = (href: string) => isActive(href) || (href === "/me" && overflowActive);
  const chatOn = chatUnread !== null && items.some((n) => n.href === "/chat");
  // Liegt der Chat mobil unter «Mehr», trägt «Mehr» den Zähler, damit nichts übersehen wird.
  const badgeTab = chatOn ? (tabs.some((n) => n.href === "/chat") ? "/chat" : "/me") : null;
  const title = tenant?.name ?? "Standchef";
  const admins = adminLinks(admin);
  // Für die Verwaltung: längster passender Link ist aktiv (/admin/members/import nicht zusätzlich /admin)
  const activeAdmin = admins.filter((n) => matches(n.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

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
            const active = isActive(n.href) && !(n.href === "/me" && activeAdmin);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-3 rounded-control px-3 h-11 text-[15px] font-medium transition-colors", active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2")}>
                <n.icon className="h-5 w-5" /> <span className="flex-1">{n.label}</span>
                {n.href === "/chat" && chatOn ? <ChatUnreadBadge initial={chatUnread ?? 0} /> : null}
              </Link>
            );
          })}
          {admins.length ? (
            <>
              <div className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Verwaltung</div>
              {admins.map((n) => {
                const active = activeAdmin === n.href;
                return (
                  <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                    className={cn("flex items-center gap-3 rounded-control px-3 h-11 text-[15px] font-medium transition-colors", active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2")}>
                    <n.icon className="h-5 w-5" /> <span className="flex-1">{n.label}</span>
                  </Link>
                );
              })}
            </>
          ) : null}
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
          <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map((n) => {
              const active = isTabActive(n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className="press flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium min-w-0">
                  <span className={cn("relative flex h-8 w-full max-w-14 items-center justify-center rounded-full transition-colors", active ? "bg-accent text-accent-ink" : "text-ink-3")}>
                    <n.icon className="h-5 w-5" />
                    {badgeTab === n.href ? (
                      <ChatUnreadBadge initial={chatUnread ?? 0} className="absolute -top-1 right-0.5 ring-2 ring-surface" />
                    ) : null}
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
