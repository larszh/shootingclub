/**
 * Resultat-Import (elektronische Trefferanzeigen, CSV): Datei lesen, Kopfzeile finden,
 * Vorlagen und Spaltenzuordnung. Reine Funktionen ohne Datenbank und ohne Server-Code –
 * auch im Browser nutzbar (Live-Vorschau) und mit Vitest getestet.
 *
 * Das Dekodieren (UTF-8/UTF-16/Windows-1252) und der CSV-Parser kommen aus dem Mitglieder-Import.
 */
import { decodeBytes, detectDelimiter, normalizeHeader, parseCsv, type CsvEncoding, type Delimiter } from "../../members/import";

export const SCORE_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const SCORE_IMPORT_MAX_ROWS = 50_000;
export const SCORE_IMPORT_MAX_COLUMNS = 120;
/** Höchstzahl Schützen pro Import (ein Durchgang). */
export const SCORE_IMPORT_MAX_SHOOTERS = 500;

// --- Felder ------------------------------------------------------------------

export const SCORE_FIELDS = [
  "ignore",
  "name",
  "firstName",
  "lastName",
  "startNo",
  "club",
  "discipline",
  "date",
  "shotNo",
  "shotValue",
  "series",
  "seriesTotal",
  "total",
  "x",
  "y",
  "teiler",
] as const;
export type ScoreField = (typeof SCORE_FIELDS)[number];

export const SCORE_FIELD_LABELS: Record<ScoreField, string> = {
  ignore: "– nicht übernehmen –",
  name: "Name (Vor- und Nachname)",
  firstName: "Vorname",
  lastName: "Nachname",
  startNo: "Startnummer",
  club: "Verein (nur Info)",
  discipline: "Disziplin / Stich",
  date: "Datum",
  shotNo: "Schuss-Nr.",
  shotValue: "Schusswert (Ring/Wert)",
  series: "Serie (Nummer)",
  seriesTotal: "Serientotal",
  total: "Total",
  x: "Trefferlage X",
  y: "Trefferlage Y",
  teiler: "Teiler (nur Info)",
};

/** Felder, die mehreren Spalten zugeordnet werden dürfen (in Spaltenreihenfolge). */
export const MULTI_FIELDS: ReadonlySet<ScoreField> = new Set<ScoreField>(["seriesTotal", "shotValue"]);

export function isScoreField(v: unknown): v is ScoreField {
  return typeof v === "string" && (SCORE_FIELDS as readonly string[]).includes(v);
}

/** Aufbau der Datei: eine Zeile pro Schuss oder eine Zeile pro Schütze (Serien/Total). */
export type ScoreLayout = "shots" | "totals";

// --- Vorlagen ----------------------------------------------------------------

export type ScorePresetId = "generic" | "meyton" | "sius" | "shotmarker";
type Aliases = Partial<Record<ScoreField, string[]>>;

/** Typische Spaltennamen (normalisiert: klein, ohne Akzente, nur a–z/0–9). */
const COMMON: Aliases = {
  name: ["name", "schuetze", "schutze", "schuetzenname", "namevorname", "vornamename", "teilnehmer", "fullname", "shooter", "athlete", "athlet"],
  firstName: ["vorname", "firstname", "prenom", "givenname"],
  lastName: ["nachname", "familienname", "lastname", "nom", "surname", "familyname"],
  startNo: ["startnummer", "startnr", "start", "stnr", "bib", "startno", "lizenz", "lizenznummer", "id"],
  club: ["verein", "club", "gesellschaft", "societe", "team"],
  discipline: ["disziplin", "disziplinname", "stich", "wettkampf", "programm", "discipline", "event", "match"],
  date: ["datum", "date", "zeitpunkt", "timestamp", "schussdatum", "wettkampfdatum"],
  shotNo: ["schuss", "schussnr", "schussnummer", "nr", "shot", "shotno", "shotnumber", "schusszahl"],
  shotValue: ["wert", "ring", "ringe", "ringwert", "zehntel", "dezimal", "score", "value", "treffer", "punkte"],
  series: ["serie", "serienr", "serienummer", "passe", "series", "string", "stage"],
  seriesTotal: ["serie1", "serie2", "serie3", "serie4", "serie5", "serie6", "s1", "s2", "s3", "s4", "s5", "s6", "passe1", "passe2", "passe3", "passe4"],
  total: ["total", "gesamt", "resultat", "summe", "endtotal", "result", "totalringe", "ergebnis"],
  x: ["x", "xmm", "xkoordinate", "xpos", "xposition"],
  y: ["y", "ymm", "ykoordinate", "ypos", "yposition"],
  teiler: ["teiler", "divisor", "distance", "abstand"],
};

export const SCORE_PRESETS: Record<ScorePresetId, { label: string; format: "CSV" | "MEYTON" | "SIUS" | "SHOTMARKER"; hint: string; layout: ScoreLayout; aliases: Aliases }> = {
  generic: {
    label: "Allgemein (CSV)",
    format: "CSV",
    hint: "Eigene Liste: eine Zeile pro Schuss (Name, Schuss, Wert) oder pro Schütze (Name, Serie 1 … Total).",
    layout: "totals",
    aliases: {},
  },
  meyton: {
    label: "Meyton (Export)",
    format: "MEYTON",
    hint: "Schussexport aus Meyton (z.B. Startnummer, Name, Vorname, Disziplin, Schuss, Ring/Wert, Teiler, X, Y).",
    layout: "shots",
    aliases: {
      shotValue: ["wert", "zehntelwert", "ringzehntel", "dezimalwert", "ring", "ringe"],
      shotNo: ["schuss", "schussnummer", "nr"],
      series: ["serie", "serienr"],
      discipline: ["disziplin", "disziplinname", "disziplinbezeichnung"],
      x: ["x", "xmm", "xkoord"],
      y: ["y", "ymm", "ykoord"],
    },
  },
  sius: {
    label: "SIUS (SIUSData Export)",
    format: "SIUS",
    hint: "Export aus SIUSData (z.B. StartNr, Nachname, Vorname, Disziplin, Serie, Schuss, Wert, X, Y).",
    layout: "shots",
    aliases: {
      startNo: ["startnr", "startnummer", "lizenznr", "lizenz"],
      shotValue: ["wert", "zehntel", "dezimal", "ringe", "ring", "primaryscore", "score"],
      series: ["serie", "passe", "seriennummer"],
      shotNo: ["schuss", "schussnr", "shot", "shotnr"],
      discipline: ["disziplin", "stich", "programm"],
    },
  },
  shotmarker: {
    label: "ShotMarker (CSV)",
    format: "SHOTMARKER",
    hint: "CSV-Export einer Serie (String) aus ShotMarker: Schuss-ID, Wert (z.B. 10, X, V), X/Y in mm. Ohne Namensspalte gehört alles zu einem Schützen.",
    layout: "shots",
    aliases: {
      shotNo: ["id", "shot", "shotid", "number"],
      shotValue: ["score", "value"],
      series: ["string", "stringname"],
      x: ["xmm", "x", "xin"],
      y: ["ymm", "y", "yin"],
      name: ["shooter", "name"],
      startNo: [],
    },
  },
};
export const SCORE_PRESET_IDS = Object.keys(SCORE_PRESETS) as ScorePresetId[];
export function isScorePreset(v: unknown): v is ScorePresetId {
  return typeof v === "string" && v in SCORE_PRESETS;
}
/** Hinweis: Exportformate unterscheiden sich je nach Version. */
export const PRESET_DISCLAIMER = "Vorlage, bitte mit eigener Exportdatei prüfen";

// --- Datei lesen -------------------------------------------------------------

export type ScoreTable = {
  headers: string[];
  rows: string[][];
  /** Nummer der ersten Datenzeile (1-basiert, ohne Leerzeilen), für Meldungen. */
  firstLine: number;
  encoding: CsvEncoding;
  delimiter: Delimiter;
};

const KNOWN_HEADERS: Set<string> = (() => {
  const s = new Set<string>();
  const add = (a: Aliases) => Object.values(a).forEach((list) => list?.forEach((h) => s.add(h)));
  add(COMMON);
  for (const p of Object.values(SCORE_PRESETS)) add(p.aliases);
  return s;
})();

/**
 * Kopfzeile suchen: Manche Exporte (z.B. ShotMarker) haben Vorspann-Zeilen. Gewählt wird unter
 * den ersten 25 Zeilen die mit den meisten bekannten Spaltennamen (mindestens 2), sonst Zeile 1.
 */
export function findHeaderRow(rows: string[][]): number {
  let best = 0;
  let bestScore = 1;
  rows.slice(0, 25).forEach((r, i) => {
    const score = r.filter((c) => KNOWN_HEADERS.has(normalizeHeader(c))).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

/** Datei → Kopfzeile + Datenzeilen. Wirft einen Error mit deutscher Meldung bei unbrauchbaren Dateien. */
export function readScoreFile(bytes: Uint8Array): ScoreTable {
  if (bytes.length === 0) throw new Error("Die Datei ist leer.");
  if (bytes.length > SCORE_IMPORT_MAX_BYTES) throw new Error("Die Datei ist grösser als 5 MB. Bitte in mehrere Dateien aufteilen.");
  const { text, encoding } = decodeBytes(bytes);
  if (text.includes("\u0000")) throw new Error("Das sieht nicht nach einer Text- oder CSV-Datei aus. Bitte den Export als CSV oder TXT speichern.");
  const delimiter = detectDelimiterSkippingPreamble(text);
  const all = parseCsv(text, delimiter);
  if (all.length > SCORE_IMPORT_MAX_ROWS + 25) throw new Error(`Zu viele Zeilen (${all.length}). Höchstens ${SCORE_IMPORT_MAX_ROWS} pro Import.`);
  const headerIdx = findHeaderRow(all);
  const data = all.slice(headerIdx + 1);
  if (data.length === 0) throw new Error("Die Datei enthält keine Datenzeilen (erste Zeile = Spaltennamen).");
  if (data.length > SCORE_IMPORT_MAX_ROWS) throw new Error(`Zu viele Zeilen (${data.length}). Höchstens ${SCORE_IMPORT_MAX_ROWS} pro Import.`);
  const width = Math.min(SCORE_IMPORT_MAX_COLUMNS, [all[headerIdx]!, ...data].reduce((w, r) => Math.max(w, r.length), 0));
  const headers = Array.from({ length: width }, (_, i) => (all[headerIdx]![i] ?? "").trim().slice(0, 100) || `Spalte ${i + 1}`);
  const rows = data.map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? "").trim().slice(0, 200)));
  return { headers, rows, firstLine: headerIdx + 2, encoding, delimiter };
}

/**
 * Trennzeichen erkennen. Vorspann-Zeilen (eine Spalte, z.B. «String: 1») werden übersprungen:
 * massgebend ist die erste Zeile mit mindestens einem Trennzeichen.
 */
function detectDelimiterSkippingPreamble(text: string): Delimiter {
  const lines = text.split(/\r\n|\n|\r/).slice(0, 30);
  const first = lines.find((l) => /[;,\t]/.test(l));
  return detectDelimiter(first ?? text);
}

// --- Spaltenzuordnung ----------------------------------------------------------

/** Vorschlag pro Spalte. Felder ausser Serientotal/Schusswert werden höchstens einmal vergeben. */
export function suggestScoreMapping(headers: string[], preset: ScorePresetId): ScoreField[] {
  const norm = headers.map(normalizeHeader);
  const used = new Set<ScoreField>();
  const result: ScoreField[] = headers.map(() => "ignore");
  const lookups: Aliases[] = [SCORE_PRESETS[preset].aliases, COMMON];
  for (const aliases of lookups) {
    for (const [field, names] of Object.entries(aliases) as Array<[ScoreField, string[]]>) {
      if (!names?.length) continue;
      if (used.has(field) && !(field === "seriesTotal")) continue;
      // Reihenfolge der Aliase = Priorität: erst den besten Namen suchen
      for (const n of names) {
        const col = norm.findIndex((h, i) => h === n && result[i] === "ignore");
        if (col < 0) continue;
        result[col] = field;
        used.add(field);
        if (field !== "seriesTotal") break;
      }
    }
  }
  // «Name» neben «Vorname» ist der Nachname (z.B. Meyton: Name;Vorname)
  const nameIdx = result.indexOf("name");
  if (nameIdx >= 0 && result.includes("firstName") && !result.includes("lastName")) result[nameIdx] = "lastName";
  // Serienspalten wie «Serie 1», «S1», «Passe 2» auch über Muster erkennen
  norm.forEach((h, i) => {
    if (result[i] === "ignore" && /^(serie|s|passe|series)\d{1,2}$/.test(h)) result[i] = "seriesTotal";
  });
  return result;
}

/** Aufbau aus der Zuordnung ableiten: Schusswert ohne Serientotal → Zeile pro Schuss. */
export function suggestLayout(mapping: readonly ScoreField[], preset: ScorePresetId): ScoreLayout {
  const shotCols = mapping.filter((f) => f === "shotValue").length;
  const hasTotals = mapping.some((f) => f === "seriesTotal" || f === "total");
  if (shotCols === 1 && !hasTotals) return "shots";
  if (shotCols === 0 && hasTotals) return "totals";
  if (shotCols > 1) return "totals";
  return SCORE_PRESETS[preset].layout;
}

/** Vorlage anhand typischer Spaltennamen erraten (nur Vorschlag). */
export function detectScorePreset(headers: string[]): ScorePresetId {
  const norm = new Set(headers.map(normalizeHeader));
  if (norm.has("teiler") && (norm.has("ring") || norm.has("wert"))) return "meyton";
  if (norm.has("startnr") && norm.has("serie") && norm.has("wert")) return "sius";
  if ((norm.has("xmm") || norm.has("ymm")) && norm.has("score")) return "shotmarker";
  return "generic";
}

/** Zuordnung bereinigen: Einzelfelder höchstens einmal (erste Spalte gewinnt). */
export function normalizeMapping(mapping: readonly unknown[], width: number): ScoreField[] {
  const seen = new Set<ScoreField>();
  return Array.from({ length: width }, (_, i) => {
    const f = mapping[i];
    if (!isScoreField(f) || f === "ignore") return "ignore";
    if (!MULTI_FIELDS.has(f)) {
      if (seen.has(f)) return "ignore";
      seen.add(f);
    }
    return f;
  });
}

// --- Werte lesen -------------------------------------------------------------

/**
 * Zahl aus «10», «10.5», «10,5», «' 9.8 '». Leer → null, unlesbar → NaN.
 */
export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/['’\s]/g, "");
  if (!s) return null;
  if (!/^[-+]?\d+([.,]\d+)?$/.test(s)) return Number.NaN;
  return Number(s.replace(",", "."));
}

/**
 * Schusswert lesen. Neben Zahlen auch Kürzel elektronischer Anzeigen:
 * «X» (Innenzehner) = 10, «V» (Bull, F-Class) = 5, «5V»/«10X» = Zahl, «M»/«Miss»/«-» = 0.
 */
export function parseShotValue(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = parseNumber(s);
  if (n !== null && !Number.isNaN(n)) return n;
  const u = s.toUpperCase();
  if (u === "X") return 10;
  if (u === "V") return 5;
  if (u === "M" || u === "MISS" || u === "-" || u === "0M") return 0;
  const m = /^(\d{1,3}(?:[.,]\d)?)\s*[XV*]$/.exec(u);
  if (m) return Number(m[1]!.replace(",", "."));
  return Number.NaN;
}

/**
 * Probeschuss-Kennzeichen (z.B. «Probe», «P», «Sighter»). In der Schuss-Nr. zählen zusätzlich
 * «P1» und «S1» (ShotMarker nummeriert Probeschüsse so), in der Serie nicht («S1» = Serie 1).
 */
export function isSighter(raw: string, column: "series" | "shotNo"): boolean {
  const s = normalizeHeader(raw);
  if (!s) return false;
  if (/^(probe|proben|probeschuss|probeschusse|sighter|sighters|sight|warmup|einschiessen|p)$/.test(s)) return true;
  return column === "shotNo" && /^[ps]\d{1,3}$/.test(s);
}
