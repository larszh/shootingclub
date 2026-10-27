import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Standchef", template: "%s · Standchef" },
  description: "Die App für Schiessvereine und Schiessanlagen in der Schweiz: Punkteerfassung, Zielscheiben und mehr.",
  applicationName: "Standchef",
  appleWebApp: { capable: true, title: "Standchef", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ee" },
    { media: "(prefers-color-scheme: dark)", color: "#111110" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
