import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mariadb", "@prisma/adapter-mariadb"],
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  async headers() {
    return [
      {
        // Schutz gegen Clickjacking: nur die eigene Origin darf die App einbetten
        // (die Druckansicht bettet eigene PDF-Uploads per <iframe> ein).
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // Die Dateiauslieferung (/api/documents) setzt eine eigene, strengere Sandbox-CSP
        // inkl. frame-ancestors; ein zweiter CSP-Header würde sie überschreiben.
        source: "/((?!api/documents/).*)",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }],
      },
    ];
  },
};

export default nextConfig;
