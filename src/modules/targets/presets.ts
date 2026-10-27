import type { TargetInput } from "./types";

/** Globale Scheibenvorlagen (Seed). */
export const TARGET_PRESETS: TargetInput[] = [
  { name: "10-Ring Pistole", description: "Ringscheibe 1–10, schwarzer Spiegel ab 7.", subject: "RINGS_10", paperSizes: ["A4", "A5", "A6"], params: { numbers: true, blackFrom: 7 }, sharedWithTenant: false },
  { name: "10-Ring Gewehr (klein)", description: "Kleine Ringscheibe 1–10 mit Spiegel ab 4, für Luftgewehr und Kleinkaliber.", subject: "RINGS_10", paperSizes: ["A4", "A5", "A6"], params: { diameterMm: 80, numbers: true, blackFrom: 4 }, sharedWithTenant: false },
  { name: "5-Ring gross", description: "Grobe Ringe 6–10, gut sichtbar auf Distanz.", subject: "RINGS_5", paperSizes: ["A4", "A5"], params: { numbers: true }, sharedWithTenant: false },
  { name: "Punkte-Raster 3×4", description: "Zwölf kleine Scheiben für Präzisionsserien.", subject: "DOTS", paperSizes: ["A4", "A5"], params: { columns: 3, rows: 4 }, sharedWithTenant: false },
  { name: "Einschiessraster 10 mm", description: "Zentimeterraster mit Fadenkreuz.", subject: "GRID", paperSizes: ["A4", "A5", "A6"], params: { gridMm: 10 }, sharedWithTenant: false },
  { name: "Oval-Silhouette", description: "Trefferzonen A/C/D für dynamisches Training.", subject: "SILHOUETTE", paperSizes: ["A4", "A5"], params: {}, sharedWithTenant: false },
  { name: "Rauten 2×3", description: "Sechs Rauten, kontrastreich.", subject: "DIAMOND", paperSizes: ["A4", "A5"], params: { columns: 2, rows: 3 }, sharedWithTenant: false },
];
