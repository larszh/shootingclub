import type { MetadataRoute } from "next";

/** Web-App-Manifest: macht Standchef installierbar (Startbildschirm, Vollbild). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Standchef",
    short_name: "Standchef",
    description: "Die App für Schiessvereine: Resultate erfassen, Zielscheiben drucken, Verein verwalten – auch ohne Empfang im Schiessstand.",
    lang: "de-CH",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#f4f2ee",
    theme_color: "#f4f2ee",
    categories: ["sports", "productivity", "utilities"],
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Durchgang starten", short_name: "Schiessen", url: "/scores/matches/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Offline-Übersicht", short_name: "Offline", url: "/offline", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
