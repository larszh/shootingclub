/**
 * Import-Helfer: Spaltenzuordnung mit Claude – Schema, Prompt und Prüfung des Vorschlags
 * gegen die erlaubten Zielfelder (rein, ohne Server-Code, getestet).
 */
import * as z from "zod/v4";
import { UNTRUSTED_NOTICE, untrusted } from "@/lib/ai/prompt";
import { MULTI_FIELDS, SCORE_FIELDS, type ScoreField, type ScoreLayout } from "@/modules/scores/import/parse";
import { IMPORT_FIELDS, type ImportField } from "@/modules/members/import";
import type { AssistKind } from "./mask";

export type Confidence = "high" | "medium" | "low";
export const CONFIDENCES: readonly Confidence[] = ["high", "medium", "low"];

/** Zielfelder pro Import mit Beschreibung für Claude (Englisch). */
const SCORE_HINTS: Record<ScoreField, string> = {
  ignore: "column is not needed",
  name: "full name of the shooter (first and last name in one column)",
  firstName: "first name of the shooter",
  lastName: "last name / family name of the shooter",
  startNo: "start number, licence number or shooter id",
  club: "club / team of the shooter (information only)",
  discipline: "discipline, match or competition name",
  date: "date or timestamp of the shot/result",
  shotNo: "number of the shot within the series or match",
  shotValue: "value of a single shot (ring value, decimal ring, hit 0/1, X). May be used for several columns (one per shot)",
  series: "number/label of the series (passe) that the shot belongs to",
  seriesTotal: "total of one series. May be used for several columns (series 1, series 2 …)",
  total: "overall total of the shooter",
  x: "x coordinate of the hit",
  y: "y coordinate of the hit",
  teiler: "Teiler / distance from centre (information only)",
};

const MEMBER_HINTS: Record<ImportField, string> = {
  ignore: "column is not needed",
  firstName: "first name",
  lastName: "last name / family name",
  name: "full name in one column",
  email: "e-mail address",
  phone: "landline / private phone",
  mobile: "mobile phone",
  street: "street and house number",
  zip: "postcode",
  city: "town / city",
  zipCity: "postcode and town in one column",
  birthDate: "date of birth",
  joinedAt: "date the person joined the club",
  leftAt: "date the person left the club",
  memberNumber: "membership number within the club",
  licenseNumber: "shooting licence number (SSV/FST licence)",
  status: "membership status or type (active, passive, honorary, junior, left …)",
  category: "fee category / membership fee group",
  note: "free-text remark",
};

export function assistFields(kind: AssistKind): readonly string[] {
  return kind === "scores" ? SCORE_FIELDS : IMPORT_FIELDS;
}

function multiFields(kind: AssistKind): ReadonlySet<string> {
  return kind === "scores" ? (MULTI_FIELDS as ReadonlySet<string>) : new Set<string>();
}

export function mappingSchema(kind: AssistKind) {
  const fields = assistFields(kind) as [string, ...string[]];
  return z.object({
    columns: z.array(z.object({ column: z.number().int(), field: z.enum(fields), confidence: z.enum(["high", "medium", "low"]) })),
    layout: z.enum(["shots", "totals", "unknown"]),
    note: z.string(),
  });
}

export type MappingOutput = z.infer<ReturnType<typeof mappingSchema>>;

export const MAPPING_SYSTEM = [
  "You help a Swiss shooting club import a CSV or spreadsheet file into the club app.",
  "Assign each column of the file to one target field of the app, based on the column names and a few anonymised sample rows.",
  "Column names may be in German, French, Italian or English, or come from scoring systems (Meyton, SIUS, ShotMarker) or club software (ClubDesk, WebLing).",
  "Placeholders like [name 1], [email], [phone], [date DD.MM.YYYY], [text] or digits replaced by 9 stand for anonymised values.",
  "",
  "Rules:",
  "- Use only the target fields listed. Use \"ignore\" when no field fits or you are unsure.",
  "- Each target field may be used for at most one column, except fields marked as usable for several columns.",
  "- Return one entry per column you assign (columns you leave out count as \"ignore\"). Refer to columns by their number.",
  "- confidence: high = clearly matches, medium = probable, low = guess.",
  "- layout (results import only): \"shots\" if each row is one shot, \"totals\" if each row is one shooter with series totals or a total, otherwise \"unknown\". For a member import always \"unknown\".",
  "- note: one short sentence in the requested language about anything the user should check (may be empty).",
  "",
  UNTRUSTED_NOTICE,
].join("\n");

export function buildMappingPrompt(kind: AssistKind, masked: { headers: string[]; rows: string[][] }): string {
  const fields = assistFields(kind);
  const hints = (kind === "scores" ? SCORE_HINTS : MEMBER_HINTS) as Record<string, string>;
  const multi = multiFields(kind);
  const fieldList = fields.map((f) => `- ${f}: ${hints[f] ?? f}${multi.has(f) ? " [several columns allowed]" : ""}`).join("\n");
  const cols = masked.headers.map((h, i) => `${i}: ${h || "(empty)"} | samples: ${masked.rows.map((r) => r[i] || "–").join(" ; ")}`).join("\n");
  return [
    `Import type: ${kind === "scores" ? "shooting results (scores) from an electronic scoring system or a list" : "club members"}.`,
    "",
    "Target fields:",
    fieldList,
    "",
    "Columns of the file (number: name | sample values):",
    untrusted("columns", cols),
  ].join("\n");
}

export type ValidatedMapping = {
  /** Zielfeld pro Spalte (Länge = Anzahl Spalten), unbekannte → «ignore» */
  mapping: string[];
  /** Sicherheit pro Spalte (null = nicht zugeordnet) */
  confidence: Array<Confidence | null>;
  layout: ScoreLayout | null;
  /** Verworfene Einträge (ungültige Spalte, unbekanntes Feld, doppelt) */
  dropped: number;
  note: string;
};

const RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

/**
 * Vorschlag prüfen: nur bestehende Spalten, nur erlaubte Felder, Einzelfelder höchstens einmal
 * (höhere Sicherheit gewinnt, bei Gleichstand die frühere Spalte). Unbekanntes wird verworfen.
 */
export function validateSuggestedMapping(kind: AssistKind, raw: unknown, columnCount: number): ValidatedMapping {
  const allowed = new Set(assistFields(kind));
  const multi = multiFields(kind);
  const mapping: string[] = Array.from({ length: Math.max(0, columnCount) }, () => "ignore");
  const confidence: Array<Confidence | null> = mapping.map(() => null);
  let dropped = 0;
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const entries = Array.isArray(obj.columns) ? obj.columns : [];

  type Entry = { column: number; field: string; confidence: Confidence };
  const valid: Entry[] = [];
  const seenColumns = new Set<number>();
  for (const e of entries) {
    const c = e && typeof e === "object" ? (e as Record<string, unknown>) : {};
    const column = typeof c.column === "number" ? c.column : Number.NaN;
    const field = typeof c.field === "string" ? c.field : "";
    const conf: Confidence = CONFIDENCES.includes(c.confidence as Confidence) ? (c.confidence as Confidence) : "low";
    if (!Number.isInteger(column) || column < 0 || column >= columnCount || !allowed.has(field) || seenColumns.has(column)) {
      dropped++;
      continue;
    }
    seenColumns.add(column);
    if (field === "ignore") continue;
    valid.push({ column, field, confidence: conf });
  }

  // Einzelfelder: bestes Angebot pro Feld
  const winner = new Map<string, Entry>();
  for (const e of valid) {
    if (multi.has(e.field)) continue;
    const cur = winner.get(e.field);
    if (!cur || RANK[e.confidence] > RANK[cur.confidence] || (RANK[e.confidence] === RANK[cur.confidence] && e.column < cur.column)) winner.set(e.field, e);
  }
  for (const e of valid) {
    if (!multi.has(e.field) && winner.get(e.field) !== e) {
      dropped++;
      continue;
    }
    mapping[e.column] = e.field;
    confidence[e.column] = e.confidence;
  }

  const layout = kind === "scores" && (obj.layout === "shots" || obj.layout === "totals") ? obj.layout : null;
  const note = typeof obj.note === "string" ? obj.note.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  return { mapping, confidence, layout, dropped, note };
}

/** Anzahl Spalten, deren Zuordnung sich gegenüber der aktuellen ändern würde. */
export function countChanges(current: readonly string[], next: readonly string[]): number {
  let n = 0;
  for (let i = 0; i < next.length; i++) if ((current[i] ?? "ignore") !== next[i]) n++;
  return n;
}
