/**
 * Inhaltsübersetzungen: reine Logik (ohne DB, getestet). Läuft nur auf dem Server (node:crypto).
 * - contentHash: Prüfsumme des Quelltexts, um veraltete Übersetzungen zu erkennen
 * - pickDisplay: welche Fassung ein Mitglied sieht (Übersetzung nur, wenn vollständig und aktuell)
 */
import { createHash } from "node:crypto";
import type { Locale } from "@/lib/i18n/core";

/** Zeilenenden vereinheitlichen und aussen trimmen (Speichern im Formular ändert sonst die Prüfsumme). */
export function normalizeSourceText(text: string | null | undefined): string {
  return (text ?? "").replace(/\r\n?/g, "\n").trim();
}

/** sha256 (hex) des normalisierten Quelltexts – Wert für ContentTranslation.sourceHash. */
export function contentHash(text: string | null | undefined): string {
  return createHash("sha256").update(normalizeSourceText(text)).digest("hex");
}

export function isContentHash(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
}

export type TranslationRowLite = {
  entityId?: string;
  field: string;
  locale: string;
  value: string;
  sourceHash: string;
  status: string; // AUTO | REVIEWED
};

/** empty: Quellfeld leer (nichts zu übersetzen) · missing · fresh · stale: Quelltext seither geändert */
export type FieldStatus = "empty" | "missing" | "fresh" | "stale";

export function fieldStatus(row: Pick<TranslationRowLite, "sourceHash" | "value"> | null | undefined, source: string | null | undefined): FieldStatus {
  if (!normalizeSourceText(source)) return "empty";
  if (!row || !row.value.trim()) return "missing";
  return row.sourceHash === contentHash(source) ? "fresh" : "stale";
}

/** Zustand einer Sprache über alle Felder: fresh nur, wenn jedes nicht leere Feld aktuell übersetzt ist. */
export type LocaleStatus = "missing" | "partial" | "fresh" | "stale";

export function localeStatus(rows: readonly TranslationRowLite[], sources: Record<string, string | null | undefined>, locale: string): LocaleStatus {
  const states = Object.entries(sources)
    .map(([field, src]) => fieldStatus(rows.find((r) => r.locale === locale && r.field === field), src))
    .filter((s) => s !== "empty");
  if (!states.length || states.every((s) => s === "missing")) return "missing";
  if (states.every((s) => s === "fresh")) return "fresh";
  if (states.some((s) => s === "stale")) return "stale";
  return "partial";
}

/** Sprachen, die (neu) übersetzt werden müssen: fehlend, unvollständig oder veraltet (force: alle). */
export function localesToTranslate(
  rows: readonly TranslationRowLite[],
  sources: Record<string, string | null | undefined>,
  targets: readonly Locale[],
  force = false,
): Locale[] {
  if (!Object.values(sources).some((s) => normalizeSourceText(s))) return [];
  return targets.filter((l) => force || localeStatus(rows, sources, l) !== "fresh");
}

export type DisplayChoice<F extends string> = {
  fields: Record<F, string | null>;
  /** true: Übersetzung wird angezeigt */
  translated: boolean;
  /** true: alle angezeigten Übersetzungen wurden von Hand geprüft/bearbeitet */
  reviewed: boolean;
};

/**
 * Fassung für die Anzeige: Übersetzung in der Sprache des Mitglieds, wenn alle nicht leeren Felder
 * aktuell übersetzt sind – sonst das Original (nie gemischt). Gleiche Sprache wie Quelle → Original.
 */
export function pickDisplay<F extends string>(input: {
  viewerLocale: Locale;
  sourceLocale: Locale;
  sources: Record<F, string | null>;
  rows: readonly TranslationRowLite[];
  /** Original erzwingen («Original anzeigen») */
  original?: boolean;
}): DisplayChoice<F> {
  const original: DisplayChoice<F> = { fields: { ...input.sources }, translated: false, reviewed: false };
  if (input.original || input.viewerLocale === input.sourceLocale) return original;
  const fields = { ...input.sources };
  let any = false;
  let reviewed = true;
  for (const key of Object.keys(input.sources) as F[]) {
    const src = input.sources[key];
    if (!normalizeSourceText(src)) continue;
    const row = input.rows.find((r) => r.locale === input.viewerLocale && r.field === key);
    if (fieldStatus(row, src) !== "fresh" || !row) return original;
    fields[key] = row.value;
    any = true;
    if (row.status !== "REVIEWED") reviewed = false;
  }
  if (!any) return original;
  return { fields, translated: true, reviewed };
}

/** Zeilen nach entityId gruppieren (für Listen). */
export function groupRowsByEntity<R extends TranslationRowLite & { entityId: string }>(rows: readonly R[]): Map<string, R[]> {
  const map = new Map<string, R[]>();
  for (const r of rows) {
    const list = map.get(r.entityId) ?? [];
    list.push(r);
    map.set(r.entityId, list);
  }
  return map;
}

/** Text auf die Feldlänge kürzen (an der Zeichengrenze, ohne halbe Ersatzzeichen). */
export function clipText(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max).join("");
}
