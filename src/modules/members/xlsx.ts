/**
 * Minimaler Leser für Excel-Dateien (.xlsx): erstes Tabellenblatt als Text-Tabelle.
 * Unterstützt geteilte Zeichenketten, Inline-Text, Zahlen und Wahrheitswerte. Formeln liefern
 * den zuletzt berechneten Wert. Datumszellen kommen als Excel-Seriennummer (parseSwissDate
 * erkennt sie in Datumsspalten). Rein, ohne Server-Abhängigkeiten.
 */
import { strFromU8, unzipSync } from "fflate";
import { IMPORT_MAX_ROWS, type ParsedTable } from "./import";

const MAX_COLUMNS = 200;

export function isXlsx(bytes: Uint8Array) {
  // ZIP-Signatur «PK\x03\x04»
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** Text aller <t>-Knoten eines Elements (Rich-Text besteht aus mehreren <r><t>…</t></r>). */
function textOf(xml: string) {
  let out = "";
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1];
  return decodeXml(out);
}

/** «AB12» → Spaltenindex 27 (0-basiert). */
export function columnIndex(ref: string) {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function readXlsxBytes(bytes: Uint8Array): ParsedTable {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        const wanted = f.name === "xl/sharedStrings.xml" || f.name === "xl/workbook.xml" || f.name === "xl/_rels/workbook.xml.rels" || /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name);
        // Schutz vor «ZIP-Bomben»: entpackt höchstens 40 MB pro Teil
        if (wanted && f.originalSize > 40 * 1024 * 1024) throw new Error("too large");
        return wanted;
      },
    });
  } catch {
    throw new Error("Die Excel-Datei konnte nicht gelesen werden. Bitte als CSV speichern und erneut hochladen.");
  }
  const shared: string[] = [];
  const ss = files["xl/sharedStrings.xml"];
  if (ss) for (const m of strFromU8(ss).matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]!));

  // Erstes Blatt laut Arbeitsmappe, sonst sheet1.xml
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = files["xl/workbook.xml"];
  const rels = files["xl/_rels/workbook.xml.rels"];
  if (wb && rels) {
    const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(strFromU8(wb))?.[1];
    const target = rid ? new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(strFromU8(rels))?.[1] ?? new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(strFromU8(rels))?.[1] : undefined;
    if (target) {
      const p = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
      if (files[p]) sheetPath = p;
    }
  }
  const sheet = files[sheetPath] ?? Object.entries(files).find(([k]) => k.startsWith("xl/worksheets/"))?.[1];
  if (!sheet) throw new Error("Kein Tabellenblatt in der Excel-Datei gefunden.");

  const xml = strFromU8(sheet);
  const table: string[][] = [];
  for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const attrs = rm[1] ?? rm[3] ?? "";
    const rowNum = Number(/\br="(\d+)"/.exec(attrs)?.[1] ?? table.length + 1);
    if (rowNum > IMPORT_MAX_ROWS + 1) throw new Error(`Zu viele Zeilen. Höchstens ${IMPORT_MAX_ROWS} pro Import.`);
    const cells: string[] = [];
    let nextCol = 0;
    for (const cm of (rm[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = cm[1] ?? "";
      const body = cm[2] ?? "";
      const ref = /\br="([A-Z]+)\d+"/.exec(a)?.[1];
      const ci = ref ? columnIndex(ref) : nextCol;
      nextCol = ci + 1;
      if (ci >= MAX_COLUMNS) continue;
      const type = /\bt="([^"]+)"/.exec(a)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = textOf(body);
      else if (type === "b") value = v === "1" ? "ja" : "nein";
      else if (v !== undefined) value = decodeXml(v);
      cells[ci] = value;
    }
    while (table.length < rowNum - 1) table.push([]);
    table[rowNum - 1] = Array.from(cells, (c) => (c ?? "").trim());
  }
  const all = table.filter((r) => r.some((c) => c !== ""));
  if (all.length < 2) throw new Error("Die Excel-Datei enthält keine Datenzeilen (erste Zeile = Spaltennamen).");
  const width = Math.min(MAX_COLUMNS, all.reduce((w, r) => Math.max(w, r.length), 0));
  const headers = Array.from({ length: width }, (_, i) => (all[0]![i] ?? "").trim() || `Spalte ${i + 1}`);
  const rows = all.slice(1).map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? "").trim()));
  if (rows.length > IMPORT_MAX_ROWS) throw new Error(`Zu viele Zeilen (${rows.length}). Höchstens ${IMPORT_MAX_ROWS} pro Import.`);
  return { headers, rows, encoding: "utf-8", delimiter: ";" };
}
