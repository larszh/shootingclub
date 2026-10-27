import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { Toaster } from "@/components/ui/toaster";
import { DialogHost } from "@/components/ui/dialog";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_THEME_COLORS } from "@/lib/brand";
import { unstable_rethrow } from "next/navigation";

export const metadata: Metadata = {
  title: { default: "Standchef", template: "%s · Standchef" },
  description: "Die App für Schiessvereine und Schiessanlagen in der Schweiz: Punkteerfassung, Zielscheiben und mehr.",
  applicationName: "Standchef",
  appleWebApp: { capable: true, title: "Standchef", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

/** Gewählte Darstellung des angemeldeten Benutzers; «system» bzw. abgemeldet → null. */
async function forcedTheme(): Promise<"light" | "dark" | null> {
  try {
    const user = await getCurrentUser();
    return user?.themePref === "light" || user?.themePref === "dark" ? user.themePref : null;
  } catch (e) {
    // Next-interne Signale (dynamisches Rendering, Redirects) nicht verschlucken.
    unstable_rethrow(e);
    return null;
  }
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await forcedTheme();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: theme
      ? DEFAULT_THEME_COLORS[theme]
      : [
          { media: "(prefers-color-scheme: light)", color: DEFAULT_THEME_COLORS.light },
          { media: "(prefers-color-scheme: dark)", color: DEFAULT_THEME_COLORS.dark },
        ],
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await forcedTheme();
  return (
    <html lang="de-CH" className={`${GeistSans.variable} ${GeistMono.variable}`} data-theme={theme ?? undefined} suppressHydrationWarning>
      <body>
        {children}
        <Toaster />
        <DialogHost />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
