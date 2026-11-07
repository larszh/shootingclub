import "server-only";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { SupportDoc } from "./prompt";

/** Höchstlänge pro Datei und insgesamt (Zeichen, ≈ 4 Zeichen pro Token). */
export const DOC_FILE_CAP = 40_000;
export const DOC_TOTAL_CAP = 110_000;

/** Kürzt eine Datei und vermerkt das. */
export function capDocs(docs: SupportDoc[], fileCap = DOC_FILE_CAP, totalCap = DOC_TOTAL_CAP): SupportDoc[] {
  const out: SupportDoc[] = [];
  let total = 0;
  for (const d of docs) {
    const room = Math.min(fileCap, totalCap - total);
    if (room <= 200) break;
    const text = d.text.length > room ? d.text.slice(0, room) + "\n[… truncated]" : d.text;
    out.push({ name: d.name, text });
    total += text.length;
  }
  return out;
}

let cached: { at: number; docs: SupportDoc[] } | null = null;
const TTL_MS = 10 * 60_000;

/**
 * README.md und docs/*.md aus dem Projektordner (die App läuft mit `next start` im Repo).
 * Fehlt eine Datei, wird sie übersprungen. Für 10 Minuten im Speicher gehalten.
 */
export async function loadSupportDocs(root: string = process.cwd()): Promise<SupportDoc[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.docs;
  const names: string[] = ["README.md"];
  try {
    // turbopackIgnore: nur Laufzeit-Lesen, die Dateien gehören nicht in die Build-Ausgabe.
    const files = await readdir(path.join(/*turbopackIgnore: true*/ root, "docs"));
    for (const f of files.sort()) if (/^[A-Za-z0-9._-]+\.md$/.test(f)) names.push(`docs/${f}`);
  } catch {
    // kein docs-Ordner
  }
  const docs: SupportDoc[] = [];
  for (const name of names) {
    try {
      const text = await readFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ root, name), "utf8");
      if (text.trim()) docs.push({ name, text: text.replace(/\r\n?/g, "\n") });
    } catch {
      // Datei fehlt
    }
  }
  const out = capDocs(docs);
  cached = { at: Date.now(), docs: out };
  return out;
}
