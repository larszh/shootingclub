import type { NextConfig } from "next";
import { frameAncestors } from "./src/modules/embed/logic";

/**
 * Widgets für Vereinswebsites (/embed/…) dürfen auf fremden Seiten eingebettet werden.
 * Erlaubte Seiten über EMBED_FRAME_ANCESTORS (z.B. "https://www.sv-muster.ch https://*.muster.ch"),
 * Standard «*» (nur wenn leer). Ungültige Einträge werden beim Build gewarnt; ohne gültigen Eintrag
 * gilt «'self'». Wird beim Build gelesen (next.config), Änderungen brauchen einen neuen Build.
 */
const EMBED_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  "img-src 'self' data:",
  "base-uri 'none'",
  "form-action 'none'",
  `frame-ancestors ${frameAncestors(process.env.EMBED_FRAME_ANCESTORS, (bad) =>
    console.warn(`[standchef] EMBED_FRAME_ANCESTORS: ungültige Einträge ignoriert: ${bad.map((b) => JSON.stringify(b)).join(", ")}`),
  )}`,
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["mariadb", "@prisma/adapter-mariadb"],
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
      {
        // Schutz gegen Clickjacking: nur die eigene Origin darf die App einbetten
        // (die Druckansicht bettet eigene PDF-Uploads per <iframe> ein). Ausnahme: Widgets unter /embed.
        source: "/((?!embed(?:/|$)).*)",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
      {
        // Die Dateiauslieferung (/api/documents) setzt eine eigene, strengere Sandbox-CSP
        // inkl. frame-ancestors; ein zweiter CSP-Header würde sie überschreiben. /embed hat eine eigene CSP.
        source: "/((?!api/documents/|embed(?:/|$)).*)",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }],
      },
      {
        // Widgets: einbettbar (kein X-Frame-Options), ohne externe Ressourcen.
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: EMBED_CSP }],
      },
    ];
  },
};

export default nextConfig;
