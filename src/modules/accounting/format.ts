import { csvAmount, toCsv } from "@/modules/billing/csv";
import type { JournalEntry } from "./journal";
import { ENTRY_TYPE_LABEL, KIND_LABEL, SOURCE_LABEL } from "./journal";
import { formatDateCh } from "./period";
import type { ExportFormat } from "./types";

/**
 * Darstellung des Journals in den Exportformaten. CSV über den gemeinsamen Helfer der Beiträge
 * (Semikolon, UTF-8-BOM, Schutz vor Formel-Injection); Banana als Textdatei mit Tabulatoren.
 */

/** Betrag in Franken mit zwei Dezimalen und Punkt, z.B. 45.00 */
export const formatAmount = csvAmount;

/**
 * Feld für Banana (Tabulator-getrennt): Tabs und Zeilenumbrüche würden Spalten bzw. Zeilen
 * verschieben und werden durch Leerzeichen ersetzt. Wie im CSV-Helfer wird ein führendes
 * =, +, -, @ mit einem Apostroph entschärft (die Datei lässt sich auch in Excel öffnen),
 * reine Zahlen bleiben unverändert.
 */
export function bananaCell(v: string) {
  const s = v.replace(/[\t\r\n]+/g, " ");
  return /^[=+\-@]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s) ? `'${s}` : s;
}

/**
 * Banana «Buchungen importieren» (Textdatei mit Spaltenüberschriften). Banana ordnet die Spalten über
 * die internen Spaltennamen der Tabelle Buchungen zu (Date, Doc, Description, AccountDebit,
 * AccountCredit, Amount), nicht über die deutschen Anzeigenamen; Datum im Format JJJJ-MM-TT.
 */
export const BANANA_HEADER = ["Date", "Doc", "Description", "AccountDebit", "AccountCredit", "Amount"] as const;

export function renderBanana(entries: JournalEntry[]) {
  const rows = entries.map((e) => [e.date, e.doc, e.text, e.debit, e.credit, formatAmount(e.amountCents)].map(bananaCell).join("\t"));
  return [BANANA_HEADER.join("\t"), ...rows].join("\r\n") + "\r\n";
}

/** bexio: CSV für den manuellen Import (Zuordnung der Spalten in bexio wählen). */
export function renderBexio(entries: JournalEntry[]) {
  return toCsv([
    ["Datum", "Beleg", "Text", "Soll", "Haben", "Betrag"],
    ...entries.map((e) => [formatDateCh(e.date), e.doc, e.text, e.debit, e.credit, formatAmount(e.amountCents)]),
  ]);
}

/** Allgemeines CSV mit Zusatzspalten. */
export function renderGenericCsv(entries: JournalEntry[]) {
  return toCsv([
    ["Datum", "Beleg", "Text", "Soll", "Haben", "Betrag", "Währung", "Bereich", "Art", "Buchungsart"],
    ...entries.map((e) => [formatDateCh(e.date), e.doc, e.text, e.debit, e.credit, formatAmount(e.amountCents), e.currency, SOURCE_LABEL[e.source], KIND_LABEL[e.kind], ENTRY_TYPE_LABEL[e.type]]),
  ]);
}

export function renderJournal(format: ExportFormat, entries: JournalEntry[]) {
  if (format === "banana") return renderBanana(entries);
  if (format === "bexio") return renderBexio(entries);
  return renderGenericCsv(entries);
}

/** Dateiname, z.B. buchungen-sg-musterhausen-2026-01-01-2026-12-31-banana.txt */
export function exportFilename(format: ExportFormat, tenantSlug: string, from: string, to: string) {
  const ext = format === "banana" ? "txt" : "csv";
  const base = (tenantSlug || "verein").replace(/[^a-z0-9-]/gi, "").toLowerCase() || "verein";
  return `buchungen-${base}-${from}-${to}-${format}.${ext}`;
}
