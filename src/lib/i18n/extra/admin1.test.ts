import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import dict, { frenchSpacing, PARTS } from "./admin1";
import { msgKey, trMsg } from "./admin1/msg";
import { getT } from "../core";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** Quelltexte, die das Wörterbuch «admin1» verwenden. */
const ROOT = join(__dirname, "../../../..");
const SOURCE_DIRS = [
  "src/app/(app)/admin/members",
  "src/app/(app)/admin/billing",
  "src/app/(app)/admin/payments",
  "src/app/(app)/admin/accounting",
  "src/app/(app)/admin/kiosk",
  "src/app/(app)/admin/bookings",
  "src/app/(app)/admin/ammo",
  "src/app/(app)/admin/files",
  "src/app/(app)/admin/audit",
  "src/app/(app)/kiosk",
  "src/modules/members",
  "src/modules/billing",
  "src/modules/accounting",
  "src/modules/kiosk",
  "src/modules/ammo",
  "src/modules/files",
];
const SOURCE_FILES = ["src/app/(app)/admin/page.tsx", "src/app/(app)/admin/forms.tsx"];

function walk(dir: string): string[] {
  const abs = join(ROOT, dir);
  return readdirSync(abs).flatMap((name) => {
    const rel = join(dir, name);
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [rel] : [];
  });
}

describe("Wörterbuch «admin1»", () => {
  const de = dict.de;

  it("hat Einträge und nur Schlüssel mit Präfix adm1.", () => {
    expect(Object.keys(de).length).toBeGreaterThan(1000);
    expect(Object.keys(de).filter((k) => !k.startsWith("adm1."))).toEqual([]);
  });

  it("Teil-Wörterbücher überschneiden sich nicht mit dem Hauptteil", () => {
    // Die Teile unter ./admin1/ werden zusammengeführt; ein doppelter Schlüssel würde still überschrieben.
    const src = readFileSync(join(ROOT, "src/lib/i18n/extra/admin1.ts"), "utf8");
    const all = [...src.matchAll(/^\s*"(adm1\.[^"]+)":/gm)].map((m) => m[1]!);
    for (const part of Object.values(PARTS)) all.push(...Object.keys(part));
    expect(all.filter((k, i) => all.indexOf(k) !== i)).toEqual([]);
  });

  it("fr, it und en haben jeden deutschen Schlüssel, keine leeren Texte", () => {
    for (const lang of [dict.fr, dict.it, dict.en]) {
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
      if (JSON.stringify(placeholders(dict.en[k] ?? "")) !== p) bad.push(`en:${k}`);
    }
    expect(bad).toEqual([]);
  });

  it("Mehrzahl: zu jedem .one gibt es .other", () => {
    const missing = Object.keys(de).filter((k) => k.endsWith(".one") && !(k.replace(/\.one$/, ".other") in de));
    expect(missing).toEqual([]);
  });

  it("Französisch: Guillemets mit schmalem geschütztem Leerzeichen", () => {
    expect(frenchSpacing("«Test» : ok ?")).toBe("« Test » : ok ?");
    const fr = Object.entries(dict.fr);
    expect(fr.filter(([, v]) => /«(?! )|(?<! )»/.test(v)).map(([k]) => k)).toEqual([]);
  });

  it("Deutsch ohne ß (Schweizer Rechtschreibung)", () => {
    expect(Object.entries(de).filter(([, v]) => v.includes("ß")).map(([k]) => k)).toEqual([]);
  });

  it("alle im Code verwendeten adm1-Schlüssel existieren", () => {
    const files = [...SOURCE_DIRS.flatMap(walk), ...SOURCE_FILES];
    const missing = new Set<string>();
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), "utf8");
      for (const m of src.matchAll(/["'`](adm1\.[a-zA-Z0-9_.]+)["'`]/g)) {
        const key = m[1]!;
        if (key.endsWith(".")) continue;
        // Präfixe wie «adm1.member.access.password» (+ .title/.text) gelten, wenn Unterschlüssel existieren.
        if (!(key in de) && !Object.keys(de).some((k) => k.startsWith(`${key}.`))) missing.add(`${f}: ${key}`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it("dynamisch gebildete Schlüssel existieren", () => {
    const families: Record<string, string[]> = {
      "adm1.kiosk.status.": ["all", "open", "billed", "cash"],
      "adm1.kiosk.preset.": ["last-month", "this-month", "last-quarter", "this-year", "last-year", "custom"],
      "adm1.kiosk.csv.": ["date", "member", "guest", "product", "quantity", "price", "total", "status", "invoice", "invoiceStatus", "recordedBy", "file"],
      "adm1.ammo.status.": ["ORDERED", "APPROVED", "ISSUED", "CANCELLED"],
      "adm1.ammo.pay.": ["UNPAID", "PAID", "CANCELLED"],
      "adm1.ammo.kind.": ["RECEIPT", "ISSUE", "SALE", "RETURN", "INVENTORY", "CORRECTION"],
      "adm1.ammo.kindShort.": ["RECEIPT", "ISSUE", "SALE", "RETURN", "INVENTORY", "CORRECTION"],
      "adm1.ammo.funding.": ["FEDERAL_FREE", "SUBSIDIZED", "COMMERCIAL"],
      "adm1.ammo.fundingShort.": ["FEDERAL_FREE", "SUBSIDIZED", "COMMERCIAL"],
      "adm1.ammo.fundingHint.": ["FEDERAL_FREE", "SUBSIDIZED", "COMMERCIAL"],
      "adm1.ammo.book.placeholder.": ["RECEIPT", "ISSUE", "RETURN", "CORRECTION"],
      "adm1.ammo.year.col.": ["opening", "receipt", "issue", "sale", "returned", "adjust", "closing"],
    };
    const missing = Object.entries(families).flatMap(([prefix, keys]) => keys.map((k) => prefix + k).filter((k) => !(k in de)));
    expect(missing).toEqual([]);
  });

  it("getT liefert die Texte in allen Sprachen", () => {
    expect(getT("de")("adm1.ammo.title")).toBe("Munition");
    expect(getT("fr")("adm1.ammo.title")).toBe("Munitions");
    expect(getT("it")("adm1.ammo.title")).toBe("Munizioni");
    expect(getT("en")("adm1.ammo.title")).toBe("Ammunition");
  });
});

describe("trMsg (deutsche Meldungen übersetzen)", () => {
  it("übersetzt exakte Meldungen", () => {
    expect(trMsg(getT("fr"), "Produkt nicht gefunden.")).toBe("Produit introuvable.");
    expect(trMsg(getT("en"), "Bestellung storniert.")).toBe("Order cancelled.");
  });

  it("übersetzt Meldungen mit Werten über Muster", () => {
    expect(msgKey("Zugang 12 gebucht.")).toEqual({ key: "adm1.ammo.msg.inBooked", vars: { n: "12" } });
    expect(trMsg(getT("it"), "Zu wenig an Lager: «GP 11» (noch 3).")).toBe("Scorta insufficiente: «GP 11» (ancora 3).");
    expect(trMsg(getT("en"), "Maximal 191 Zeichen.")).toBe("At most 191 characters.");
  });

  it("Zahl-Platzhalter treffen nur Zahlen", () => {
    // «Rechnung {year}» darf «Rechnung storniert.» nicht treffen.
    expect(trMsg(getT("en"), "Rechnung storniert.")).toBe("Invoice cancelled.");
    expect(trMsg(getT("en"), "Max. Dateigrösse: 1 bis 200 MB.")).toBe("Max. file size: 1 to 200 MB.");
    expect(msgKey("Zugang viele gebucht.")).toBeNull();
  });

  it("jede feste Meldung der Server-Aktionen hat einen Eintrag", () => {
    const ACTIONS = ["members/actions.ts", "billing/actions.ts", "billing/import-actions.ts", "kiosk/actions.ts", "ammo/actions.ts", "ammo/stock-actions.ts", "files/actions.ts"];
    const missing: string[] = [];
    for (const f of ACTIONS) {
      const src = readFileSync(join(ROOT, "src/modules", f), "utf8");
      // fail("…") und Meldungen in ok(…, "…" / Bedingung ? "…" : "…") sowie zod-Meldungen in .max(…, "…")/.refine(…, "…")
      const lines = src.split("\n").filter((l) => /\b(fail|ok)\(|\.(max|min|regex|refine)\(|message:/.test(l));
      for (const line of lines) {
        for (const m of line.matchAll(/"([A-ZÄÖÜ][^"]*[a-zäöüß.!)][^"]*)"/g)) {
          const text = m[1]!;
          if (!/\s/.test(text) || text.includes("${")) continue;
          if (!msgKey(text)) missing.push(`${f}: ${text}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("lässt Unbekanntes und Deutsch unverändert", () => {
    expect(trMsg(getT("fr"), "Etwas ganz anderes")).toBe("Etwas ganz anderes");
    expect(trMsg(getT("de"), "Produkt gelöscht.")).toBe("Produkt gelöscht.");
    expect(trMsg(getT("en"), "")).toBe("");
  });
});
