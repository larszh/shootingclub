import type { Viewport } from "next";
import { getAppContext } from "@/lib/tenant";
import { AppShell } from "@/components/app-shell";
import { BrandTheme } from "@/components/brand-theme";
import { DEFAULT_THEME_COLORS, brandColors } from "@/lib/brand";

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
  return (
    <>
      <BrandTheme brandColor={ctx.tenant?.brandColor} brandColor2={ctx.tenant?.brandColor2} />
      <AppShell
        enabledModules={ctx.tenant?.enabledModules ?? []}
        tenant={ctx.tenant ? { id: ctx.tenant.id, name: ctx.tenant.name, logoUrl: ctx.tenant.logoUrl } : null}
        user={{ name: ctx.user.name, email: ctx.user.email, avatarUrl: ctx.user.avatarUrl }}
      >
        {children}
      </AppShell>
    </>
  );
}
