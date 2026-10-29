import type { Viewport } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui";
import { getAppContext } from "@/lib/tenant";
import { AppShell } from "@/components/app-shell";
import { BrandTheme } from "@/components/brand-theme";
import { DEFAULT_THEME_COLORS, brandColors } from "@/lib/brand";
import { getUnreadChatCount } from "@/modules/chat/queries";

/**
 * Browser-Leiste (theme-color): mit Vereinsfarbe die Akzentfarbe, sonst der Seitenhintergrund
 * passend zur gewählten Darstellung (System / Hell / Dunkel).
 */
export async function generateViewport(): Promise<Viewport> {
  const ctx = await getAppContext();
  const pref = ctx.user.themePref;
  const brand = brandColors(ctx.tenant?.brandColor);
  if (brand) {
    if (pref === "light") return { themeColor: brand.light.accent };
    if (pref === "dark") return { themeColor: brand.dark.accent };
    return {
      themeColor: [
        { media: "(prefers-color-scheme: light)", color: brand.light.accent },
        { media: "(prefers-color-scheme: dark)", color: brand.dark.accent },
      ],
    };
  }
  if (pref === "light") return { themeColor: DEFAULT_THEME_COLORS.light };
  if (pref === "dark") return { themeColor: DEFAULT_THEME_COLORS.dark };
  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: DEFAULT_THEME_COLORS.light },
      { media: "(prefers-color-scheme: dark)", color: DEFAULT_THEME_COLORS.dark },
    ],
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  // Startwert für den Ungelesen-Zähler; danach aktualisiert ihn der Chat-Stream im Browser.
  const chatUnread = ctx.tenant && ctx.hasModule("chat") ? await getUnreadChatCount(ctx.user.id, ctx.tenant.id).catch(() => 0) : null;
  return (
    <>
      <BrandTheme brandColor={ctx.tenant?.brandColor} brandColor2={ctx.tenant?.brandColor2} />
      <AppShell
        enabledModules={ctx.tenant?.enabledModules ?? []}
        tenant={ctx.tenant ? { id: ctx.tenant.id, name: ctx.tenant.name, logoUrl: ctx.tenant.logoUrl } : null}
        user={{ name: ctx.user.name, email: ctx.user.email, avatarUrl: ctx.user.avatarUrl }}
        chatUnread={chatUnread}
        admin={{
          settings: ctx.can("tenant.manage"),
          members: ctx.can("members.view"),
          membersManage: ctx.can("members.manage"),
          audit: ctx.can("audit.view"),
          system: ctx.user.isSuperAdmin,
        }}
      >
        {ctx.tenant?.deletedAt ? (
          <div className="mb-4">
            <Alert tone="error">
              Dieser Verein ist zur Löschung vorgemerkt (endgültig nach 30 Tagen). Wiederherstellen unter{" "}
              <Link href="/super/tenants?show=deleted" className="font-semibold underline underline-offset-2">Tenants</Link>.
            </Alert>
          </div>
        ) : null}
        {children}
      </AppShell>
    </>
  );
}
