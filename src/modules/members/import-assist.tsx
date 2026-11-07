"use client";

import { ColumnAssist } from "@/modules/ai/coach/ui/column-assist";
import type { ImportField } from "./import";

/**
 * «Spalten mit Claude zuordnen» für den Mitglieder-Import (Schritt «Spalten»).
 * Blendet sich selbst aus, wenn der Import-Helfer im Verein nicht verfügbar ist.
 * Gesendet werden nur Spaltennamen und drei maskierte Beispielzeilen (ohne Namen, E-Mail, Telefon,
 * mit unkenntlich gemachten Daten und Zahlen); übernommen wird erst nach Bestätigung.
 *
 * Einbau im Assistenten (MapStep): <MemberImportAssist headers={parsed.headers} rows={parsed.rows}
 *   mapping={mapping} fields={fields} onApply={onMapping} />
 */
export function MemberImportAssist({ headers, rows, mapping, fields, onApply, className }: {
  headers: string[];
  rows: string[][];
  mapping: readonly ImportField[];
  fields: ReadonlyArray<{ value: ImportField; label: string }>;
  onApply: (mapping: ImportField[]) => void;
  className?: string;
}) {
  return <ColumnAssist kind="members" headers={headers} rows={rows} mapping={mapping} fields={fields} onApply={(m) => onApply(m)} className={className} />;
}
