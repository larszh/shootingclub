/**
 * Reine Logik der Übersetzungs-Verwaltung (/super/translations): Platzhalter prüfen,
 * Import-Dateien prüfen, Schlüssel in Pakete für Claude aufteilen, Wort-Diff für die Vorschau.
 * Ohne Server- und Wörterbuch-Abhängigkeiten (Client und Server, testbar).
 */
import { LOCALES, isLocale, type Locale } from "@/lib/i18n/locales";

/** Maximale Länge eines übersteuerten Textes. */
export const MAX_VALUE_LENGTH = 5000;
/** Maximale Schlüssellänge (TranslationOverride.key ist VARCHAR(191)). */
export const MAX_KEY_LENGTH = 191;
/** Schlüssel pro Claude-Aufruf. */
export const AI_CHUNK_SIZE = 80;
/** Zeichen (Ausgangstexte) pro Claude-Aufruf, damit lange Texte die Antwort nicht sprengen. */
export const AI_CHUNK_CHARS = 10_000;
/** Höchstens so viele Schlüssel pro Lauf «Mit Claude übersetzen». */
export const AI_MAX_KEYS_PER_RUN = 2000;
/** Höchstens so viele Einträge pro Speichern/Import. */
export const MAX_ENTRIES_PER_SAVE = 10_000;

export const EXPORT_FORMAT = "standchef-translations";
export const EXPORT_VERSION = 1;

// ---------------------------------------------------------------------------
// Platzhalter

const PLACEHOLDER_RE = /\{(\w+)\}/g;

/** Namen der {name}-Platzhalter (eindeutig, sortiert) – wie interpolate() in core.ts. */
export function placeholdersOf(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER_RE)) out.add(m[1]!);
  return [...out].sort();
}

export type PlaceholderCheck = { ok: true } | { ok: false; missing: string[]; extra: string[] };

/** Prüft, ob `text` dieselben Platzhalter wie die Referenz (deutscher Text) hat. */
export function checkPlaceholders(reference: string | undefined, text: string): PlaceholderCheck {
  const want = new Set(placeholdersOf(reference ?? ""));
  const have = new Set(placeholdersOf(text));
  const missing = [...want].filter((p) => !have.has(p));
  const extra = [...have].filter((p) => !want.has(p));
  return missing.length || extra.length ? { ok: false, missing, extra } : { ok: true };
}

// ---------------------------------------------------------------------------
// Einzelnen Wert prüfen (Bearbeiten, Import, Claude-Vorschlag)

export type EntryErrorCode = "unknownKey" | "placeholders" | "tooLong" | "notString" | "badLocale";

export type EntryError = { key: string; code: EntryErrorCode; missing?: string[]; extra?: string[] };

/** Was die Prüfung über die Wörterbücher wissen muss (auf Client und Server aus core.ts). */
export type DictionaryContext = {
  /** Gibt es den Schlüssel in einem Wörterbuch? */
  hasKey: (key: string) => boolean;
  /** Referenz für Platzhalter: mitgelieferter deutscher Text (sonst der Text der Sprache). */
  reference: (locale: Locale, key: string) => string | undefined;
  /** Mitgelieferter Text der Sprache (ohne Übersteuerung). */
  base: (locale: Locale, key: string) => string | undefined;
  /** Aktuelle Übersteuerung der Sprache. */
  override: (locale: Locale, key: string) => string | undefined;
};

/**
 * Normalisiert Zeilenumbrüche und schneidet Leerraum am Rand ab. Mit `padding` (mitgelieferter
 * Text) wird dessen Leerraum am Anfang/Ende wieder angefügt: Texte wie « (ich)» oder
 * « · {n} offen» werden an andere Texte angehängt, das Leerzeichen ist Teil des Textes.
 * Leer bleibt leer.
 */
export function normalizeValue(v: string, padding?: string): string {
  const core = v.replace(/\r\n?/g, "\n").trim();
  if (!core || !padding) return core;
  const lead = /^\s*/.exec(padding)![0];
  const trail = /\s*$/.exec(padding)![0];
  return lead.length === padding.length ? core : lead + core + trail;
}

/** Prüft einen nicht-leeren Wert. null = in Ordnung. */
export function validateValue(ctx: DictionaryContext, locale: Locale, key: string, value: unknown): EntryError | null {
  if (typeof key !== "string" || key.length === 0 || key.length > MAX_KEY_LENGTH || !ctx.hasKey(key)) return { key: String(key), code: "unknownKey" };
  if (typeof value !== "string") return { key, code: "notString" };
  if (value.length > MAX_VALUE_LENGTH) return { key, code: "tooLong" };
  const pc = checkPlaceholders(ctx.reference(locale, key), value);
  if (!pc.ok) return { key, code: "placeholders", missing: pc.missing, extra: pc.extra };
  return null;
}

export type PlannedChange = {
  key: string;
  /** Bisher wirksamer Text dieser Sprache (Übersteuerung oder mitgeliefert; leer = fehlt) */
  before: string;
  /** Neuer wirksamer Text */
  after: string;
  /** "set": Übersteuerung schreiben · "reset": Übersteuerung löschen (Standard gilt wieder) */
  op: "set" | "reset";
};

/**
 * Leitet aus einem gewünschten Text die Änderung ab. Leer oder gleich wie der mitgelieferte Text
 * → Übersteuerung löschen. null = keine Änderung.
 */
export function planChange(ctx: DictionaryContext, locale: Locale, key: string, raw: string): PlannedChange | null {
  const base = ctx.base(locale, key);
  const value = normalizeValue(raw, base ?? ctx.reference(locale, key));
  const current = ctx.override(locale, key);
  const before = current ?? base ?? "";
  if (value === "" || value === base) {
    if (current === undefined) return null;
    return { key, before, after: base ?? "", op: "reset" };
  }
  if (value === current) return null;
  return { key, before, after: value, op: "set" };
}

export type ValidationResult = { changes: PlannedChange[]; unchanged: number; skipped: number; errors: EntryError[] };

/**
 * Prüft viele Einträge (Import, Claude-Vorschläge, Speichern mehrerer Zellen).
 * `skipEmpty`: leere Werte überspringen statt zurücksetzen (Import).
 */
export function validateEntries(
  ctx: DictionaryContext,
  locale: Locale,
  entries: ReadonlyArray<{ key: string; value: unknown }>,
  opts?: { skipEmpty?: boolean },
): ValidationResult {
  const changes: PlannedChange[] = [];
  const errors: EntryError[] = [];
  const seen = new Set<string>();
  let unchanged = 0;
  let skipped = 0;
  for (const e of entries) {
    if (seen.has(e.key)) continue;
    seen.add(e.key);
    if (typeof e.value === "string" && normalizeValue(e.value) === "") {
      if (opts?.skipEmpty) {
        skipped += 1;
        continue;
      }
      if (typeof e.key !== "string" || !ctx.hasKey(e.key)) {
        errors.push({ key: String(e.key), code: "unknownKey" });
        continue;
      }
    } else {
      const err = validateValue(ctx, locale, e.key, e.value);
      if (err) {
        errors.push(err);
        continue;
      }
    }
    const change = planChange(ctx, locale, e.key, e.value as string);
    if (change) changes.push(change);
    else unchanged += 1;
  }
  return { changes, unchanged, skipped, errors };
}

// ---------------------------------------------------------------------------
// Import-Datei

export type ExportFile = {
  format: typeof EXPORT_FORMAT;
  version: number;
  locale: Locale;
  mode: "overrides" | "all";
  exportedAt: string;
  entries: Record<string, string>;
};

export type ParsedImport =
  | { ok: true; locale: Locale | null; entries: Array<{ key: string; value: unknown }> }
  | { ok: false; error: "invalidJson" | "invalidShape" | "localeMismatch" | "tooMany" };

/**
 * Liest eine Import-Datei: das eigene Exportformat ({ format, locale, entries }) oder ein
 * flaches Objekt { "schlüssel": "text" }. Mit `expected` muss die Sprache der Datei passen.
 */
export function parseImportFile(raw: string, expected?: Locale): ParsedImport {
  let data: unknown;
  try {
    data = JSON.parse(raw.replace(/^﻿/, ""));
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, error: "invalidShape" };
  const rec = data as Record<string, unknown>;
  let locale: Locale | null = null;
  let map: unknown = rec;
  if ("entries" in rec) {
    if (rec.format !== undefined && rec.format !== EXPORT_FORMAT) return { ok: false, error: "invalidShape" };
    if (rec.locale !== undefined) {
      if (!isLocale(rec.locale)) return { ok: false, error: "invalidShape" };
      locale = rec.locale;
    }
    map = rec.entries;
  }
  if (!map || typeof map !== "object" || Array.isArray(map)) return { ok: false, error: "invalidShape" };
  if (expected && locale && locale !== expected) return { ok: false, error: "localeMismatch" };
  const entries = Object.entries(map as Record<string, unknown>).map(([key, value]) => ({ key, value }));
  if (entries.length > MAX_ENTRIES_PER_SAVE) return { ok: false, error: "tooMany" };
  return { ok: true, locale, entries };
}

/** Baut die Export-Datei (Schlüssel sortiert, damit Diffs lesbar bleiben). */
export function buildExportFile(locale: Locale, mode: "overrides" | "all", entries: Record<string, string>, now: Date): ExportFile {
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(entries).sort()) sorted[k] = entries[k]!;
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, locale, mode, exportedAt: now.toISOString(), entries: sorted };
}

// ---------------------------------------------------------------------------
// Pakete für Claude

/** Teilt Einträge in Pakete von höchstens `size` Schlüsseln und ungefähr `maxChars` Zeichen. */
export function chunkForAi<T extends { key: string; source: string }>(items: readonly T[], size = AI_CHUNK_SIZE, maxChars = AI_CHUNK_CHARS): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let chars = 0;
  for (const it of items) {
    const len = it.key.length + it.source.length;
    if (cur.length > 0 && (cur.length >= size || chars + len > maxChars)) {
      out.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(it);
    chars += len;
  }
  if (cur.length) out.push(cur);
  return out;
}

export type AiSuggestion = { key: string; text: string };

/**
 * Prüft Claudes Vorschläge: nur angefragte Schlüssel, Platzhalter wie im Deutschen, nicht leer.
 * Ungültige landen in `rejected` (werden in der Vorschau nicht angeboten). Leerraum am Rand
 * kommt aus `padding` (Standard: Referenz), damit angehängte Texte ihr Leerzeichen behalten.
 */
export function filterSuggestions(
  requested: readonly string[],
  suggestions: readonly AiSuggestion[],
  reference: (key: string) => string | undefined,
  padding: (key: string) => string | undefined = reference,
): { accepted: AiSuggestion[]; rejected: Array<{ key: string; reason: "unknown" | "empty" | "placeholders" | "tooLong" }>; missing: string[] } {
  const want = new Set(requested);
  const done = new Set<string>();
  const accepted: AiSuggestion[] = [];
  const rejected: Array<{ key: string; reason: "unknown" | "empty" | "placeholders" | "tooLong" }> = [];
  for (const s of suggestions) {
    if (!want.has(s.key) || done.has(s.key)) {
      if (!want.has(s.key)) rejected.push({ key: s.key.slice(0, MAX_KEY_LENGTH), reason: "unknown" });
      continue;
    }
    done.add(s.key);
    const text = normalizeValue(s.text, padding(s.key));
    if (!text) rejected.push({ key: s.key, reason: "empty" });
    else if (text.length > MAX_VALUE_LENGTH) rejected.push({ key: s.key, reason: "tooLong" });
    else if (!checkPlaceholders(reference(s.key), text).ok) rejected.push({ key: s.key, reason: "placeholders" });
    else accepted.push({ key: s.key, text });
  }
  const missing = requested.filter((k) => !done.has(k));
  return { accepted, rejected, missing };
}

// ---------------------------------------------------------------------------
// Liste

export type CellState = "default" | "custom" | "missing";

export type Cell = {
  /** Wirksamer Text (Übersteuerung → mitgeliefert); leer, wenn die Sprache auf Deutsch zurückfällt */
  value: string;
  base: string | undefined;
  override: string | undefined;
  state: CellState;
  /** Fehlt oder gleich wie Deutsch (nur für fr/it/en) */
  needsWork: boolean;
};

export type Row = { key: string; ns: string; cells: Record<Locale, Cell>; haystack: string };

/** Namensraum = erster Teil des Schlüssels («adm1.members.title» → «adm1»). */
export function namespaceOf(key: string): string {
  const i = key.indexOf(".");
  return i < 0 ? key : key.slice(0, i);
}

/** Baut die Zeilen der Liste aus Wörterbuch und Übersteuerungen. */
export function buildRows(keys: readonly string[], ctx: Pick<DictionaryContext, "base" | "override">): Row[] {
  return keys.map((key) => {
    const cells = {} as Record<Locale, Cell>;
    for (const l of LOCALES) {
      const base = ctx.base(l, key);
      const override = ctx.override(l, key);
      const value = override ?? base ?? "";
      cells[l] = { value, base, override, state: override !== undefined ? "custom" : base !== undefined ? "default" : "missing", needsWork: false };
    }
    const de = cells.de.value;
    for (const l of LOCALES) {
      if (l === "de") continue;
      const c = cells[l];
      c.needsWork = c.value === "" || (de !== "" && c.value === de);
    }
    const haystack = [key, ...LOCALES.map((l) => cells[l].value)].join("\u0001").toLowerCase();
    return { key, ns: namespaceOf(key), cells, haystack };
  });
}

export type RowFilter = {
  query: string;
  ns: string;
  /** "all" | "custom" | "needsWork" */
  status: "all" | "custom" | "needsWork";
  /** Sprache für den Status-Filter */
  locale: Locale;
};

export function filterRows(rows: readonly Row[], f: RowFilter): Row[] {
  const q = f.query.trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  return rows.filter((r) => {
    if (f.ns && r.ns !== f.ns) return false;
    if (f.status === "custom" && !(f.locale === "de" ? r.cells.de.state === "custom" : r.cells[f.locale].state === "custom")) return false;
    if (f.status === "needsWork" && !(f.locale === "de" ? r.cells.de.state === "missing" : r.cells[f.locale].needsWork)) return false;
    for (const t of terms) if (!r.haystack.includes(t)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Wort-Diff für die Vorschau

export type DiffPart = { type: "same" | "add" | "del"; text: string };

/** Wort-Diff (LCS). Bei sehr langen Texten nur «alt gelöscht, neu hinzugefügt». */
export function wordDiff(a: string, b: string): DiffPart[] {
  if (a === b) return a ? [{ type: "same", text: a }] : [];
  const ta = a.split(/(\s+)/).filter((s) => s !== "");
  const tb = b.split(/(\s+)/).filter((s) => s !== "");
  if (ta.length * tb.length > 250_000) {
    const out: DiffPart[] = [];
    if (a) out.push({ type: "del", text: a });
    if (b) out.push({ type: "add", text: b });
    return out;
  }
  const n = ta.length;
  const m = tb.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = ta[i] === tb[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = out.at(-1);
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ta[i] === tb[j]) {
      push("same", ta[i]!);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) push("del", ta[i++]!);
    else push("add", tb[j++]!);
  }
  while (i < n) push("del", ta[i++]!);
  while (j < m) push("add", tb[j++]!);
  return out;
}
