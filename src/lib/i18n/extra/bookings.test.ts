import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import dict, { frenchSpacing } from "./bookings";
import { getT } from "../core";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** Quelltexte, die das Wörterbuch «bookings» verwenden. */
const ROOT = join(__dirname, "../../../..");
const SOURCE_DIRS = ["src/modules/bookings", "src/app/(app)/bookings", "src/app/(app)/onboarding", "src/app/(app)/admin/members/requests"];
const SOURCE_FILES = ["src/modules/core/join-requests.ts", "src/modules/core/join-notify.ts"];
/** Schlüssel, die mit Template-Strings gebildet werden (Status, Zahlungsarten, Mitteilungen). */
const DYNAMIC: Record<string, string[]> = {
  "bookings.status.": ["PENDING", "CONFIRMED", "REJECTED", "CANCELLED"],
  "bookings.payment.": ["NOT_REQUIRED", "UNPAID", "PENDING", "PAID", "FAILED", "REFUNDED", "void"],
  "bookings.method.": ["NONE", "INVOICE", "ONLINE", "CASH"],
  "bookings.kind.": ["RANGE", "LANE", "ROOM", "OTHER"],
  "bookings.whole.": ["RANGE", "LANE", "ROOM", "OTHER"],
  "bookings.notify.self.": ["confirmed.title", "confirmed.body", "cancelled.title", "cancelled.body"],
};
/** Zeichenketten mit Präfix «bookings.», die keine Übersetzungsschlüssel sind (Berechtigungen). */
const NOT_KEYS = new Set(["bookings.series"]);

function walk(dir: string): string[] {
  const abs = join(ROOT, dir);
  return readdirSync(abs).flatMap((name) => {
    const rel = join(dir, name);
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [rel] : [];
  });
}

describe("Wörterbuch «bookings»", () => {
  const de = dict.de;

  it("hat Einträge und nur Schlüssel mit Präfix bookings.", () => {
    expect(Object.keys(de).length).toBeGreaterThan(150);
    expect(Object.keys(de).filter((k) => !k.startsWith("bookings."))).toEqual([]);
  });

  it("fr und it haben jeden deutschen Schlüssel, keine leeren Texte", () => {
    for (const lang of [dict.fr, dict.it]) {
      expect(Object.keys(de).filter((k) => !(k in lang))).toEqual([]);
      expect(Object.keys(lang).filter((k) => !(k in de))).toEqual([]);
      expect(Object.entries(lang).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
    }
    expect(Object.entries(de).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });

  it("Platzhalter stimmen in allen Sprachen überein", () => {
    const bad: string[] = [];
    for (const [k, v] of Object.entries(de)) {
      const p = JSON.stringify(placeholders(v));
      if (JSON.stringify(placeholders(dict.fr[k] ?? "")) !== p) bad.push(`fr:${k}`);
      if (JSON.stringify(placeholders(dict.it[k] ?? "")) !== p) bad.push(`it:${k}`);
    }
    expect(bad).toEqual([]);
  });

  it("Französisch: Guillemets mit schmalem geschütztem Leerzeichen, Doppelpunkt geschützt", () => {
    const fr = Object.entries(dict.fr);
    expect(fr.filter(([, v]) => /«(?! )|(?<! )»/.test(v)).map(([k]) => k)).toEqual([]);
    expect(fr.filter(([, v]) => / [:;?!]/.test(v)).map(([k]) => k)).toEqual([]);
    for (const lang of [dict.de, dict.it]) {
      expect(Object.entries(lang).filter(([, v]) => /« | »/.test(v)).map(([k]) => k)).toEqual([]);
    }
    expect(frenchSpacing("« Gérer »")).toBe("« Gérer »");
    expect(frenchSpacing("Motif : x")).toBe("Motif : x");
  });

  it("Schweizer Begriffe: société de tir / società di tiro, kein ß", () => {
    expect(dict.fr["bookings.join.notify.request.body"]).toContain("société de tir");
    expect(dict.it["bookings.join.notify.request.body"]).toContain("società di tiro");
    expect(Object.entries(de).filter(([, v]) => v.includes("ß")).map(([k]) => k)).toEqual([]);
  });

  it("wird von getT gefunden, deutsche Texte bleiben", () => {
    expect(getT("de")("bookings.title")).toBe("Reservationen");
    expect(getT("fr")("bookings.title")).toBe("Réservations");
    expect(getT("it")("bookings.wizard.stepWhen", { n: 4 })).toBe("4 · Quando");
    expect(getT("de")("bookings.err.cancelDeadline", { hours: 24 })).toBe("Stornierung nur bis 24 Stunden vor Beginn möglich.");
  });

  it("dynamische Schlüssel existieren", () => {
    const missing: string[] = [];
    for (const [prefix, rest] of Object.entries(DYNAMIC)) for (const r of rest) if (!(`${prefix}${r}` in de)) missing.push(`${prefix}${r}`);
    expect(missing).toEqual([]);
  });

  it("alle im Code verwendeten Schlüssel existieren", () => {
    const files = [...SOURCE_DIRS.flatMap(walk), ...SOURCE_FILES];
    const missing = new Set<string>();
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), "utf8");
      for (const m of src.matchAll(/["`](bookings\.[A-Za-z0-9_.]+)["`]/g)) {
        const key = m[1]!;
        if (key.endsWith(".") || NOT_KEYS.has(key)) continue;
        if (!(key in de)) missing.add(`${f}: ${key}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
