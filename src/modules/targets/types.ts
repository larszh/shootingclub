import { z } from "zod";

export const PAPER_SIZES = ["A4", "A5", "A6"] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];

/** Abmessungen in mm (Hochformat) */
export const PAPER_MM: Record<PaperSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  A6: { w: 105, h: 148 },
};

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

export const TARGET_CATEGORIES = [
  { key: "rings", label: "Ringscheiben" },
  { key: "precision", label: "Präzision" },
  { key: "drills", label: "Training/Drills" },
  { key: "games", label: "Spiele" },
  { key: "silhouettes", label: "Silhouetten" },
  { key: "zeroing", label: "Einschiessen" },
  { key: "tactical", label: "Taktik & Polizei" },
  { key: "custom", label: "Eigene" },
] as const;
export type TargetCategory = (typeof TARGET_CATEGORIES)[number]["key"];

// ---------------------------------------------------------------------------
// Parameter
// ---------------------------------------------------------------------------

const variantSchema = z.string().trim().max(24).regex(/^[a-z0-9-]+$/);

/** Parameter der generierten Sujets. Alles optional, Generator hat Defaults. */
export const targetParamsSchema = z.object({
  /** Durchmesser des äussersten Rings bzw. Grösse je Ziel in mm */
  diameterMm: z.coerce.number().min(10).max(300).optional(),
  /** Anzahl Ziele pro Reihe/Spalte */
  columns: z.coerce.number().int().min(1).max(6).optional(),
  rows: z.coerce.number().int().min(1).max(8).optional(),
  /** Rasterweite in mm (GRID, ZEROING) */
  gridMm: z.coerce.number().min(2).max(50).optional(),
  /** Ringzahlen / Beschriftung anzeigen */
  numbers: z.coerce.boolean().optional(),
  /** Schwarzer Spiegel ab Ring (RINGS_10) */
  blackFrom: z.coerce.number().int().min(1).max(10).optional(),
  /** Variante des Sujets (z.B. "ovals", "bingo") */
  variant: variantSchema.optional(),
  /** Distanz, für die die Scheibe gebaut ist (m) */
  originalDistanceM: z.coerce.number().min(1).max(1000).optional(),
  /** Distanz, auf die tatsächlich geschossen wird (m) */
  shotDistanceM: z.coerce.number().min(1).max(1000).optional(),
  /** Anzahl Ringe (BLANK_RINGS) */
  ringCount: z.coerce.number().int().min(1).max(10).optional(),
  /** Anzahl Ziele (Plates, Marken, Stufen) */
  count: z.coerce.number().int().min(1).max(12).optional(),
  /** Startwert für die Anordnung (Ansage, Zahlenfeld) */
  seed: z.coerce.number().int().min(0).max(9999).optional(),
  /** Probescheibe (Mehrfachblatt) */
  sighter: z.coerce.boolean().optional(),
  /** Distanzschritt in m (Distanzleiter) */
  stepM: z.coerce.number().min(1).max(100).optional(),
  /** Anzahl Bedrohungen (Shoot/No-Shoot) */
  threats: z.coerce.number().int().min(0).max(6).optional(),
  /** Welches Ziel die Bedrohung ist (0 = gemäss Anordnung Nr.) */
  threatPos: z.coerce.number().int().min(0).max(8).optional(),
  /** Anteil Deckung in Prozent (Teildeckung, Fenster) */
  coverPct: z.coerce.number().int().min(10).max(90).optional(),
  /** Zonen-Legende und Kurzanleitung auf dem Blatt */
  legend: z.coerce.boolean().optional(),
});
export type TargetParams = z.infer<typeof targetParamsSchema>;
export type ParamKey = keyof TargetParams;

/**
 * Tolerantes Parsen gespeicherter Parameter: jedes Feld wird einzeln geprüft,
 * ungültige oder unbekannte Felder werden ignoriert statt alles zu verwerfen.
 */
export function parseTargetParams(raw: unknown): TargetParams {
  if (!raw || typeof raw !== "object") return {};
  const shape = targetParamsSchema.shape;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(shape) as ParamKey[]) {
    const v = (raw as Record<string, unknown>)[key];
    if (v === undefined || v === null || v === "") continue;
    const r = shape[key].safeParse(v);
    if (r.success && r.data !== undefined) out[key] = r.data;
  }
  return out as TargetParams;
}

type ParamKind = "number" | "bool" | "select";
export const PARAM_INFO: Record<ParamKey, { kind: ParamKind; label: string; min?: number; max?: number; step?: number; hint?: string }> = {
  diameterMm: { kind: "number", label: "Durchmesser (mm)", min: 10, max: 300, hint: "Leer = so gross wie möglich (bei Distanz-Umrechnung: 300 mm)" },
  columns: { kind: "number", label: "Spalten", min: 1, max: 6 },
  rows: { kind: "number", label: "Reihen", min: 1, max: 8 },
  gridMm: { kind: "number", label: "Rasterweite (mm)", min: 2, max: 50 },
  numbers: { kind: "bool", label: "Ringzahlen anzeigen" },
  blackFrom: { kind: "number", label: "Schwarzer Spiegel ab Ring", min: 1, max: 10 },
  variant: { kind: "select", label: "Variante" },
  originalDistanceM: { kind: "number", label: "Originaldistanz (m)", min: 1, max: 1000, hint: "Für diese Distanz ist die Scheibe gebaut" },
  shotDistanceM: { kind: "number", label: "Schussdistanz (m)", min: 1, max: 1000, hint: "Auf diese Distanz schiesst du" },
  ringCount: { kind: "number", label: "Anzahl Ringe", min: 1, max: 10 },
  count: { kind: "number", label: "Anzahl Ziele", min: 1, max: 12 },
  seed: { kind: "number", label: "Anordnung Nr.", min: 0, max: 9999, hint: "Andere Zahl = andere Reihenfolge" },
  sighter: { kind: "bool", label: "Probescheibe" },
  stepM: { kind: "number", label: "Distanzschritt (m)", min: 1, max: 100 },
  threats: { kind: "number", label: "Anzahl Bedrohungen", min: 0, max: 6 },
  threatPos: { kind: "number", label: "Bedrohung bei Nr.", min: 0, max: 8, hint: "0 = gemäss Anordnung Nr." },
  coverPct: { kind: "number", label: "Deckung (%)", min: 10, max: 90, hint: "Wie viel der Figur verdeckt ist" },
  legend: { kind: "bool", label: "Legende und Kurzanleitung anzeigen" },
};

export type FieldDef = {
  key: Exclude<ParamKey, "originalDistanceM"> | "originalDistanceM";
  label?: string;
  hint?: string;
  default?: number | boolean | string;
  min?: number;
  max?: number;
  options?: readonly { value: string; label: string }[];
};

type SubjectMeta = {
  key: string;
  label: string;
  description: string;
  category: TargetCategory;
  /** In dieser Ausbaustufe neu hinzugekommen */
  isNew?: boolean;
  /** Relevante Parameter für das Formular */
  fields: readonly FieldDef[];
  /** Skalierung auf Distanz möglich; nominalDistanceM = Vorgabe für die Originaldistanz */
  scalable?: { nominalDistanceM?: number };
};

// ---------------------------------------------------------------------------
// Sujets
// ---------------------------------------------------------------------------

export const TARGET_SUBJECTS = [
  {
    key: "RINGS_10", label: "10-Ring-Scheibe", description: "Klassische Ringscheibe 1–10 mit Zehner-Mouche.", category: "rings",
    fields: [{ key: "diameterMm" }, { key: "blackFrom", default: 7 }, { key: "numbers", default: true }],
    scalable: {},
  },
  {
    key: "RINGS_5", label: "5-Ring-Scheibe", description: "Grobe Ringe 6–10, gut sichtbar auf Distanz.", category: "rings",
    fields: [{ key: "diameterMm" }, { key: "numbers", default: true }],
    scalable: {},
  },
  {
    key: "DOTS", label: "Punkte-Raster", description: "Mehrere kleine Scheiben für Präzisionstraining.", category: "precision",
    fields: [{ key: "diameterMm", label: "Grösse je Ziel (mm)" }, { key: "columns", default: 3 }, { key: "rows", default: 4 }, { key: "numbers", default: false }],
  },
  {
    key: "GRID", label: "Einschiessraster", description: "Zentimeter-Raster mit Fadenkreuz zum Einschiessen.", category: "zeroing",
    fields: [{ key: "gridMm", default: 10 }],
  },
  {
    key: "SILHOUETTE", label: "Oval-Silhouette", description: "Ovale Zone mit Trefferzonen A/C/D.", category: "silhouettes",
    fields: [],
  },
  {
    key: "DIAMOND", label: "Rauten", description: "Rautenförmige Ziele, kontrastreich.", category: "drills",
    fields: [{ key: "diameterMm", label: "Grösse je Ziel (mm)" }, { key: "columns", default: 2 }, { key: "rows", default: 3 }],
  },
  // --- Präzision (nachempfunden) -------------------------------------------
  {
    key: "ISSF_PISTOL", label: "Präzisionspistole 25/50 m", isNew: true, category: "precision",
    description: "Nachempfunden der Präzisionsscheibe 25 m/50 m: 10er 50 mm, Ringe je 25 mm breiter, 1er 500 mm, Spiegel ab 7 (200 mm). Keine offizielle Scheibe; wird bei Bedarf verkleinert.",
    fields: [{ key: "numbers", default: true }],
    scalable: { nominalDistanceM: 25 },
  },
  {
    key: "AIR_PISTOL", label: "Luftpistole 10 m", isNew: true, category: "precision",
    description: "Nachempfunden der Luftpistolenscheibe: 10er 11.5 mm, Ringe je 16 mm grösser, aussen 155.5 mm, Spiegel 7–10 (59.5 mm), Innenzehner 5 mm. Keine offizielle Scheibe.",
    fields: [{ key: "numbers", default: true }],
    scalable: { nominalDistanceM: 10 },
  },
  {
    key: "AIR_RIFLE", label: "Luftgewehr 10 m", isNew: true, category: "precision",
    description: "Nachempfunden der Luftgewehrscheibe: 10er-Punkt 0.5 mm, 9er 5.5 mm, je 5 mm grösser, aussen 45.5 mm, Spiegel 4–9 (30.5 mm). Keine offizielle Scheibe.",
    fields: [{ key: "numbers", default: true }],
    scalable: { nominalDistanceM: 10 },
  },
  {
    key: "AIR_RIFLE_SHEET", label: "Luftgewehr-Streifen", isNew: true, category: "precision",
    description: "Mehrere Luftgewehrscheiben (nachempfunden) pro Blatt in nummerierten Feldern, wahlweise mit Probescheibe.",
    fields: [{ key: "columns", default: 2 }, { key: "rows", default: 5 }, { key: "sighter", default: true }, { key: "numbers", default: false }],
    scalable: { nominalDistanceM: 10 },
  },
  {
    key: "RAPID_FIRE", label: "Schnellfeuer/Duell 25 m", isNew: true, category: "drills",
    description: "Fünf Haltepunkte nebeneinander für Schnellfeuer- und Duell-Drills. Ringmarken (nachempfunden, 10er 100 mm) oder Ovale.",
    fields: [
      { key: "variant", default: "marks", options: [{ value: "marks", label: "Ringmarken" }, { value: "ovals", label: "Ovale" }] },
      { key: "count", label: "Ziele pro Reihe", default: 5, max: 6 },
      { key: "rows", label: "Serien (Reihen)", default: 3 },
      { key: "numbers", label: "Nummern anzeigen", default: true },
    ],
    scalable: { nominalDistanceM: 25 },
  },
  // --- Schweizer Stil (nachempfunden) --------------------------------------
  {
    key: "SWISS_A", label: "A-Scheibe (CH-Stil)", isNew: true, category: "rings",
    description: "Nachempfunden der Schweizer A-Scheibe 300 m mit 10er- oder 5er-Wertung. Masse angenähert (aussen ca. 1 m, Spiegel ca. 60 cm), keine offizielle Scheibe; wird verkleinert gedruckt.",
    fields: [
      { key: "variant", label: "Wertung", default: "10", options: [{ value: "10", label: "10er-Wertung" }, { value: "5", label: "5er-Wertung" }] },
      { key: "numbers", default: true },
    ],
    scalable: { nominalDistanceM: 300 },
  },
  {
    key: "SWISS_P10", label: "Pistole P10 (CH-Stil)", isNew: true, category: "rings",
    description: "Nachempfunden der Schweizer Pistolenscheibe P10 (50 m). Masse angenähert: 10er 50 mm, Ringbreite 25 mm, Spiegel ab 7. Keine offizielle Scheibe.",
    fields: [{ key: "numbers", default: true }],
    scalable: { nominalDistanceM: 50 },
  },
  {
    key: "BLANK_RINGS", label: "Leere Ringscheibe", isNew: true, category: "rings",
    description: "Nur Wertungsringe ohne Spiegel – für eigene Distanzen und Markierungen.",
    fields: [{ key: "diameterMm" }, { key: "ringCount", default: 10 }, { key: "numbers", default: false }],
    scalable: {},
  },
  // --- Einschiessen ---------------------------------------------------------
  {
    key: "ZEROING", label: "Einschiessen mit Rauten", isNew: true, category: "zeroing",
    description: "Zentimeter-Raster mit Rauten-Haltepunkten und Hilfetext zu Zoll, MOA und mrad.",
    fields: [{ key: "gridMm", default: 10 }, { key: "shotDistanceM", label: "Schussdistanz (m)", hint: "Für die MOA/mrad-Umrechnung", default: 25 }],
  },
  // --- Drills -----------------------------------------------------------------
  {
    key: "DOT_DRILL", label: "Punkte-Drill 1–10", isNew: true, category: "drills",
    description: "Zehn nummerierte Kreise und Quadrate mit Aufgabe pro Nummer.",
    fields: [{ key: "numbers", label: "Aufgaben anzeigen", default: true }],
  },
  {
    key: "CALLOUT", label: "Ansage-Training", isNew: true, category: "drills",
    description: "Kreise, Quadrate und Dreiecke mit Zahlen 1–9 und Buchstaben A–C. Ein Partner sagt an, du schiesst.",
    fields: [{ key: "seed", default: 1 }],
  },
  {
    key: "DISTANCE_LADDER", label: "Distanzleiter", isNew: true, category: "drills",
    description: "Dieselbe Scheibe in abnehmender Grösse: simuliert grössere Distanzen, z.B. 10/15/20/25 m beim Schiessen auf 10 m.",
    fields: [
      { key: "shotDistanceM", label: "Schussdistanz (m)", default: 10 },
      { key: "stepM", default: 5 },
      { key: "count", label: "Anzahl Stufen", default: 4, max: 8 },
      { key: "diameterMm", label: "Grösse der ersten Stufe (mm)" },
    ],
  },
  {
    key: "PLATES", label: "Plates/Kegel", isNew: true, category: "drills",
    description: "Reihe von runden Plates oder Kegeln für Speed-Drills.",
    fields: [
      { key: "variant", default: "plates", options: [{ value: "plates", label: "Plates (Kreise)" }, { value: "pins", label: "Kegel" }] },
      { key: "count", label: "Ziele pro Reihe", default: 6, max: 8 },
      { key: "rows", label: "Reihen", default: 2, max: 4 },
    ],
  },
  // --- Spiele -----------------------------------------------------------------
  {
    key: "TIC_TAC_TOE", label: "Tic-Tac-Toe", isNew: true, category: "games",
    description: "3×3-Spielfeld mit Haltepunkten – zwei Schützen spielen gegeneinander.",
    fields: [{ key: "count", label: "Spielfelder", default: 1, max: 2 }],
  },
  {
    key: "NUMBER_GRID", label: "Zahlenfeld/Bingo", isNew: true, category: "games",
    description: "5×5-Feld mit gemischten Zahlen oder Bingo-Karte (B-I-N-G-O). Zahl ansagen und treffen.",
    fields: [
      { key: "variant", default: "numbers", options: [{ value: "numbers", label: "Zahlen 1–25" }, { value: "bingo", label: "Bingo 1–75" }] },
      { key: "seed", default: 1 },
    ],
  },
  {
    key: "CLOCK", label: "Uhr", isNew: true, category: "games",
    description: "Zwölf Ziele wie ein Zifferblatt. Ansage «3 Uhr» – Ziel 3 treffen.",
    fields: [{ key: "numbers", label: "Zahlen anzeigen", default: true }],
  },
  // --- Silhouetten ------------------------------------------------------------
  {
    key: "HUMANOID", label: "Silhouette mit Zonen", isNew: true, category: "silhouettes",
    description: "Neutrale Umriss-Silhouette (ohne Gesicht) mit Trefferzonen. Varianten: Zonen A/C/D, Kopf/Brust oder mit «NS»-Zone (nicht beschiessen).",
    fields: [
      { key: "variant", default: "zones", options: [{ value: "zones", label: "Zonen A/C/D" }, { value: "headchest", label: "Kopf/Brust" }, { value: "noshoot", label: "Mit NS-Zone" }] },
    ],
  },
  // --- Taktik & Polizei --------------------------------------------------------
  // Abstrakte, gesichtslose Figuren in Schwarz-Weiss. Zonen A (Zentrum), C, D, NS (No-Shoot).
  {
    key: "TAC_HOSTAGE", label: "Geiselnahme", isNew: true, category: "tactical",
    description: "Bedroher teilweise verdeckt durch eine Geisel (grau schraffiert, NS). Nur Kopfseite und Schulter sind frei. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "variant", label: "Geisel", default: "right", options: [{ value: "right", label: "Geisel rechts" }, { value: "left", label: "Geisel links" }] },
      { key: "count", label: "Szenen pro Blatt", default: 1, max: 4 },
      { key: "numbers", label: "Szenen nummerieren", default: true },
      { key: "legend", default: true },
    ],
    scalable: {},
  },
  {
    key: "TAC_HOSTAGE_HEAD", label: "Geiselnahme: nur Kopf frei", isNew: true, category: "tactical",
    description: "Vom Bedroher ist nur ein Teil des Kopfes neben der Geisel sichtbar – sehr hohe Schwierigkeit. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "variant", label: "Geisel", default: "left", options: [{ value: "left", label: "Geisel links" }, { value: "right", label: "Geisel rechts" }] },
      { key: "count", label: "Szenen pro Blatt", default: 1, max: 4 },
      { key: "numbers", label: "Szenen nummerieren", default: true },
      { key: "legend", default: true },
    ],
    scalable: {},
  },
  {
    key: "TAC_HOSTAGE_TWO", label: "Geiselnahme: zwei Geiseln", isNew: true, category: "tactical",
    description: "Bedroher steht zwischen zwei Geiseln, frei ist nur der Kopf und ein schmaler Streifen. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "count", label: "Szenen pro Blatt", default: 1, max: 4 },
      { key: "numbers", label: "Szenen nummerieren", default: true },
      { key: "legend", default: true },
    ],
    scalable: {},
  },
  {
    key: "TAC_HOSTAGE_KNEEL", label: "Geiselnahme: Geisel kniend", isNew: true, category: "tactical",
    description: "Geisel kniet vor dem Bedroher und verdeckt den unteren Teil. Kopf und obere Brust sind frei. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "variant", label: "Geisel", default: "right", options: [{ value: "right", label: "leicht rechts" }, { value: "left", label: "leicht links" }] },
      { key: "count", label: "Szenen pro Blatt", default: 1, max: 4 },
      { key: "numbers", label: "Szenen nummerieren", default: true },
      { key: "legend", default: true },
    ],
    scalable: {},
  },
  {
    key: "TAC_SHOOT_NOSHOOT", label: "Shoot/No-Shoot-Entscheidung", isNew: true, category: "tactical",
    description: "4–6 Figuren mit Symbolen in der Hand: Pistole = Bedrohung, Telefon, Portemonnaie, offene Hand oder Ausweis = keine Bedrohung. Anordnung Nr. ergibt reproduzierbare Varianten. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "count", label: "Anzahl Figuren", default: 6, min: 4, max: 6 },
      { key: "threats", default: 2 },
      { key: "seed", default: 1 },
      { key: "variant", label: "Darstellung", default: "decision", options: [{ value: "decision", label: "Entscheidung (alle gleich)" }, { value: "marked", label: "Lernversion (NS markiert)" }] },
      { key: "numbers", label: "Figuren nummerieren", default: true },
      { key: "legend", default: true },
    ],
  },
  {
    key: "TAC_CROWD", label: "Gruppe mit Unbeteiligten", isNew: true, category: "tactical",
    description: "5–7 Figuren in zwei oder drei gestaffelten Reihen, eine davon ist die Bedrohung (Pistolen-Symbol), alle anderen sind NS. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "count", label: "Anzahl Figuren", default: 6, min: 5, max: 7 },
      { key: "threatPos", max: 7 },
      { key: "seed", default: 1 },
      { key: "numbers", label: "Figuren nummerieren", default: true },
      { key: "legend", default: true },
    ],
  },
  {
    key: "TAC_COVER_LOW", label: "Teildeckung tief (Mauer)", isNew: true, category: "tactical",
    description: "Figur hinter einer Mauer oder Kisten, nur der Oberkörper ist frei. Deckungshöhe einstellbar. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "variant", label: "Deckung", default: "wall", options: [{ value: "wall", label: "Mauer" }, { value: "crates", label: "Kisten" }] },
      { key: "coverPct", default: 45 },
      { key: "count", label: "Szenen pro Blatt", default: 1, max: 4 },
      { key: "numbers", label: "Szenen nummerieren", default: true },
      { key: "legend", default: true },
    ],
    scalable: {},
  },
  {
    key: "TAC_COVER_SIDE", label: "Barrikade seitlich / Türrahmen", isNew: true, category: "tactical",
    description: "Figur hinter einer seitlichen Deckung oder in einem Türrahmen, nur Schulter und Kopfseite sind frei. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "variant", label: "Deckung", default: "right", options: [{ value: "right", label: "rechts" }, { value: "left", label: "links" }, { value: "door", label: "Türrahmen" }] },
      { key: "coverPct", default: 55, hint: "Bei «rechts»/«links» bleiben Kopfseite und eine Schulter immer frei" },
      { key: "count", label: "Szenen pro Blatt", default: 1, max: 4 },
      { key: "numbers", label: "Szenen nummerieren", default: true },
      { key: "legend", default: true },
    ],
    scalable: {},
  },
  {
    key: "TAC_COVER_WINDOW", label: "Fenster-Öffnung", isNew: true, category: "tactical",
    description: "Figur hinter einer Wand, sichtbar nur durch eine Fensteröffnung – mittig, versetzt oder mit Fensterkreuz. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "variant", label: "Fenster", default: "center", options: [{ value: "center", label: "mittig" }, { value: "offset", label: "versetzt" }, { value: "cross", label: "mit Fensterkreuz" }] },
      { key: "coverPct", label: "Wandanteil (%)", default: 55, hint: "Mehr = kleineres Fenster" },
      { key: "count", label: "Szenen pro Blatt", default: 1, max: 4 },
      { key: "numbers", label: "Szenen nummerieren", default: true },
      { key: "legend", default: true },
    ],
    scalable: {},
  },
  {
    key: "TAC_COVER_VEHICLE", label: "Fahrzeug-Deckung", isNew: true, category: "tactical",
    description: "Figur hinter einem abstrakten Fahrzeug-Umriss: hinter dem Dach oder hinter der Motorhaube. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "variant", label: "Position", default: "roof", options: [{ value: "roof", label: "hinter dem Dach" }, { value: "hood", label: "hinter der Motorhaube" }] },
      { key: "count", label: "Szenen pro Blatt", default: 1, max: 3 },
      { key: "numbers", label: "Szenen nummerieren", default: true },
      { key: "legend", default: true },
    ],
    scalable: {},
  },
  {
    key: "TAC_HEAD_BOXES", label: "Kopfzonen-Präzision", isNew: true, category: "tactical",
    description: "Kleine Kopfzonen als Boxen oder Dreiecke, nummeriert. Grösse frei oder per Distanz-Umrechnung (Kopfbreite 1:1 = 150 mm). Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "variant", label: "Form", default: "boxes", options: [{ value: "boxes", label: "Boxen" }, { value: "triangles", label: "Dreiecke" }, { value: "mixed", label: "gemischt" }] },
      { key: "count", label: "Anzahl Ziele", default: 6 },
      { key: "diameterMm", label: "Breite je Ziel (mm)", hint: "Leer = so gross wie möglich (bei Distanz-Umrechnung: 150 mm)" },
      { key: "numbers", label: "Ziele nummerieren", default: true },
      { key: "legend", default: true },
    ],
    scalable: {},
  },
  {
    key: "TAC_SEQUENCE", label: "Mehrfachziele Reihenfolge", isNew: true, category: "tactical",
    description: "Nummerierte Figuren mit Muster-Code (Voll, Streifen, Punkte, Gitter, Leer) und Buchstaben für Reihenfolge-Drills ohne Farbe. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "count", label: "Anzahl Figuren", default: 5, min: 3, max: 8 },
      { key: "seed", default: 1 },
      { key: "numbers", label: "Reihenfolge-Nummern anzeigen", default: true },
      { key: "legend", default: true },
    ],
  },
  {
    key: "TAC_CODED_SHAPES", label: "Formen mit Muster-Code", isNew: true, category: "tactical",
    description: "Kreise, Quadrate, Dreiecke, Rauten und Sechsecke mit Muster, Buchstabe und Nummer – Ansage nach Form, Muster, Buchstabe oder Zahl. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "count", label: "Anzahl Ziele", default: 9, min: 4, max: 12 },
      { key: "seed", default: 1 },
      { key: "numbers", label: "Nummern anzeigen", default: true },
      { key: "legend", default: true },
    ],
  },
  {
    key: "TAC_MOVER", label: "Bewegung simuliert (Vorhalt)", isNew: true, category: "tactical",
    description: "Dieselbe Figur in versetzten Positionen: Ist-Position plus Vorhalte-Positionen +1, +2 … für das Vorhalten auf bewegte Ziele. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "variant", label: "Richtung", default: "right", options: [{ value: "right", label: "nach rechts" }, { value: "left", label: "nach links" }] },
      { key: "count", label: "Positionen pro Bahn", default: 3, min: 2, max: 5 },
      { key: "rows", label: "Bahnen", default: 2, max: 3 },
      { key: "legend", default: true },
    ],
  },
  {
    key: "TAC_TURNED", label: "Verdrehte Figur (Profil)", isNew: true, category: "tactical",
    description: "Figur seitlich (Profil) oder halb gedreht mit schmaler Trefferzone. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "variant", label: "Drehung", default: "mixed", options: [{ value: "profile", label: "Profil (90°)" }, { value: "half", label: "halb (45°)" }, { value: "mixed", label: "gemischt" }] },
      { key: "count", label: "Figuren pro Blatt", default: 2, max: 3 },
      { key: "numbers", label: "Figuren nummerieren", default: true },
      { key: "legend", default: true },
    ],
    scalable: {},
  },
  {
    key: "TAC_LOW_LIGHT", label: "Low-Light / Kontrast", isNew: true, category: "tactical",
    description: "Dunkel: fast schwarzes Blatt mit dünnen weissen Umrissen (braucht viel Toner!). Minimal: nur feine graue Linien, kaum Tinte. Für Ausbildung und Training, abstrakte Darstellung.",
    fields: [
      { key: "variant", label: "Darstellung", default: "dark", options: [{ value: "dark", label: "dunkel (viel Toner)" }, { value: "minimal", label: "minimal (wenig Tinte)" }] },
      { key: "count", label: "Anzahl Figuren", default: 3, max: 6 },
      { key: "numbers", label: "Figuren nummerieren", default: true },
      { key: "legend", default: true },
    ],
  },
  // --- Eigene -----------------------------------------------------------------
  {
    key: "UPLOAD", label: "Eigenes Sujet", description: "Hochgeladene Datei (PNG, JPG, SVG, PDF).", category: "custom",
    fields: [],
  },
] as const satisfies readonly SubjectMeta[];

export type TargetSubject = (typeof TARGET_SUBJECTS)[number]["key"];
export const subjectKeys = TARGET_SUBJECTS.map((s) => s.key) as [TargetSubject, ...TargetSubject[]];

export function subjectMeta(key: string): SubjectMeta | undefined {
  return (TARGET_SUBJECTS as readonly SubjectMeta[]).find((s) => s.key === key);
}
export function subjectLabel(key: string) {
  return subjectMeta(key)?.label ?? key;
}
export function subjectCategory(key: string): TargetCategory {
  return subjectMeta(key)?.category ?? "custom";
}
export function categoryLabel(key: string) {
  return TARGET_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
/** Relevante Formularfelder eines Sujets (inkl. Distanzskalierung). */
export function subjectFields(key: string): FieldDef[] {
  const m = subjectMeta(key);
  if (!m) return [];
  const fields: FieldDef[] = [...m.fields];
  if (m.scalable) {
    const nominal = m.scalable.nominalDistanceM;
    fields.push({ key: "originalDistanceM", default: undefined, hint: nominal ? `Leer = ${nominal} m` : "Leer = keine Skalierung" });
    if (!fields.some((f) => f.key === "shotDistanceM")) fields.push({ key: "shotDistanceM", hint: "z.B. 10 oder 25 m im Stand" });
  }
  return fields;
}
/** Erlaubte Varianten eines Sujets. */
export function subjectVariants(key: string): string[] {
  const f = subjectMeta(key)?.fields.find((x) => x.key === "variant");
  return f?.options ? f.options.map((o) => o.value) : [];
}

/**
 * Abhängigkeiten zwischen Parametern, die das Schema allein nicht prüft
 * (z.B. Bedrohung bei Nr. 7, aber nur 5 Figuren). Gibt eine deutsche Meldung oder null zurück.
 */
export function targetParamsIssue(subject: string, params: TargetParams): string | null {
  const countField = subjectMeta(subject)?.fields.find((f) => f.key === "count");
  const count = params.count ?? (typeof countField?.default === "number" ? countField.default : undefined);
  if (count === undefined) return null;
  if (subject === "TAC_CROWD" && params.threatPos !== undefined && params.threatPos > count) {
    return `${PARAM_INFO.threatPos.label}: höchstens ${count} (Anzahl Figuren), 0 = gemäss Anordnung`;
  }
  if (subject === "TAC_SHOOT_NOSHOOT" && params.threats !== undefined && params.threats > count) {
    return `${PARAM_INFO.threats.label}: höchstens ${count} (Anzahl Figuren)`;
  }
  return null;
}

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

// ---------------------------------------------------------------------------
// Druck-Layouts (mehrere pro Blatt)
// ---------------------------------------------------------------------------

export const PRINT_LAYOUTS = [
  { key: "single", label: "1 pro Blatt" },
  { key: "2xA5", label: "2× A5 auf A4" },
  { key: "4xA6", label: "4× A6 auf A4" },
] as const;
export type PrintLayoutKey = (typeof PRINT_LAYOUTS)[number]["key"];
