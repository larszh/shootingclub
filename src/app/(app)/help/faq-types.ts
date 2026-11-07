import type { Locale } from "@/lib/i18n/locales";
import { frenchSpacing } from "@/lib/i18n/extra/shell";

/**
 * Hilfe-Inhalte als Daten (serialisierbar, damit sie an die Client-Komponente gehen können).
 * Inline-Auszeichnung in den Texten:
 *   [Beschriftung](/pfad)  → Link innerhalb der App
 *   **fett**               → <strong>
 *   `mono`                 → Schreibmaschinenschrift (Codes, Adressen)
 */
export type FaqBlock = { p: string } | { ol: string[] } | { ul: string[] };

export type FaqText = {
  /** Frage */
  q: string;
  /** Zusätzliche Suchbegriffe (nicht sichtbar) */
  keywords: string;
  /** Antwort */
  a: FaqBlock[];
};

export type FaqAudience = "member" | "admin";

export type FaqSource = { id: string; audience: FaqAudience } & Record<Locale, FaqText>;

/** Fertig für die Anzeige in einer Sprache. */
export type FaqEntry = { id: string; audience: FaqAudience; q: string; a: FaqBlock[]; search: string };

export type InlinePart = { kind: "text" | "strong" | "mono"; text: string } | { kind: "link"; text: string; href: string };

const INLINE = /\[([^\]]+)\]\((\/[^)\s]*)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;

/** Zerlegt einen Text mit Inline-Auszeichnung in Teile (rein, testbar). */
export function parseInline(s: string): InlinePart[] {
  const out: InlinePart[] = [];
  let last = 0;
  for (const m of s.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: "text", text: s.slice(last, i) });
    if (m[1] !== undefined && m[2] !== undefined) out.push({ kind: "link", text: m[1], href: m[2] });
    else if (m[3] !== undefined) out.push({ kind: "strong", text: m[3] });
    else if (m[4] !== undefined) out.push({ kind: "mono", text: m[4] });
    last = i + m[0].length;
  }
  if (last < s.length) out.push({ kind: "text", text: s.slice(last) });
  return out;
}

/** Klartext ohne Auszeichnung (für die Suche). */
export function plainText(s: string): string {
  return parseInline(s)
    .map((p) => p.text)
    .join("");
}

/** Alle Texte eines Blocks. */
export function blockTexts(b: FaqBlock): string[] {
  return "p" in b ? [b.p] : "ol" in b ? b.ol : b.ul;
}

/** Link-Ziele einer Antwort in Reihenfolge (zum Vergleich zwischen den Sprachen). */
export function answerLinks(a: FaqBlock[]): string[] {
  return a.flatMap(blockTexts).flatMap((s) => parseInline(s).flatMap((p) => (p.kind === "link" ? [p.href] : [])));
}

/** Eintrag in einer Sprache aufbereiten. */
export function toEntry(src: FaqSource, locale: Locale): FaqEntry {
  // Französisch: Guillemets und Satzzeichen mit geschütztem Leerzeichen (wie im Wörterbuch).
  const fix = locale === "fr" ? frenchSpacing : (s: string) => s;
  const t = src[locale];
  const a: FaqBlock[] = t.a.map((b) => ("p" in b ? { p: fix(b.p) } : "ol" in b ? { ol: b.ol.map(fix) } : { ul: b.ul.map(fix) }));
  const q = fix(t.q);
  const answer = a.flatMap(blockTexts).map(plainText).join(" ");
  return { id: src.id, audience: src.audience, q, a, search: `${q} ${t.keywords} ${answer}` };
}
