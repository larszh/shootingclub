import { z } from "zod";

export const PAPER_SIZES = ["A4", "A5", "A6"] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];

/** Abmessungen in mm (Hochformat) */
export const PAPER_MM: Record<PaperSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  A6: { w: 105, h: 148 },
};

export const TARGET_SUBJECTS = [
  { key: "RINGS_10", label: "10-Ring-Scheibe", description: "Klassische Ringscheibe 1–10 mit Zehner-Mouche." },
  { key: "RINGS_5", label: "5-Ring-Scheibe", description: "Grobe Ringe 6–10, gut sichtbar auf Distanz." },
  { key: "DOTS", label: "Punkte-Raster", description: "Mehrere kleine Scheiben für Präzisionstraining." },
  { key: "GRID", label: "Einschiessraster", description: "Zentimeter-Raster mit Fadenkreuz zum Einschiessen." },
  { key: "SILHOUETTE", label: "Oval-Silhouette", description: "Ovale Zone mit Trefferzonen A/C/D." },
  { key: "DIAMOND", label: "Rauten", description: "Rautenförmige Ziele, kontrastreich." },
  { key: "UPLOAD", label: "Eigenes Sujet", description: "Hochgeladene Datei (PNG, JPG, SVG, PDF)." },
] as const;
export type TargetSubject = (typeof TARGET_SUBJECTS)[number]["key"];
export const subjectKeys = TARGET_SUBJECTS.map((s) => s.key) as [TargetSubject, ...TargetSubject[]];
export function subjectLabel(key: string) {
  return TARGET_SUBJECTS.find((s) => s.key === key)?.label ?? key;
}

/** Parameter der generierten Sujets. Alles optional, Generator hat Defaults. */
export const targetParamsSchema = z.object({
  /** Durchmesser des äussersten Rings in mm (RINGS_*, DOTS, DIAMOND) */
  diameterMm: z.coerce.number().min(10).max(300).optional(),
  /** Anzahl Ziele pro Reihe/Spalte (DOTS, DIAMOND) */
  columns: z.coerce.number().int().min(1).max(6).optional(),
  rows: z.coerce.number().int().min(1).max(8).optional(),
  /** Rasterweite in mm (GRID) */
  gridMm: z.coerce.number().min(2).max(50).optional(),
  /** Ringzahlen anzeigen */
  numbers: z.coerce.boolean().optional(),
  /** Schwarzer Spiegel ab Ring (RINGS_10) */
  blackFrom: z.coerce.number().int().min(1).max(10).optional(),
});
export type TargetParams = z.infer<typeof targetParamsSchema>;

export const targetInputSchema = z.object({
  name: z.string().trim().min(2, "Mindestens 2 Zeichen").max(80),
  description: z.string().trim().max(400).optional(),
  subject: z.enum(subjectKeys),
  paperSizes: z.array(z.enum(PAPER_SIZES)).min(1, "Mindestens ein Format"),
  params: targetParamsSchema.default({}),
  sharedWithTenant: z.boolean().default(false),
});
export type TargetInput = z.infer<typeof targetInputSchema>;

export function parsePaperSizes(raw: string): PaperSize[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is PaperSize => (PAPER_SIZES as readonly string[]).includes(s));
}

export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
