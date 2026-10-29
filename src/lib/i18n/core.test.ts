import { describe, expect, it } from "vitest";
import de from "./de";
import fr from "./fr";
import itDict from "./it";
import { formatDate, formatMoneyLocale, getT, interpolate, mergeDicts, normalizeLocale, pickExtra } from "./core";

describe("i18n core", () => {
  it("normalisiert Sprachen", () => {
    expect(normalizeLocale("fr-CH")).toBe("fr");
    expect(normalizeLocale("IT")).toBe("it");
    expect(normalizeLocale("en")).toBe("de");
    expect(normalizeLocale(null)).toBe("de");
  });

  it("übersetzt mit Rückfall auf Deutsch und Schlüssel", () => {
    expect(getT("fr")("invoice.title")).toBe("Facture");
    expect(getT("it")("invoice.annualFee")).toBe("Quota sociale");
    expect(getT("de")("invoice.payableUntil", { date: "31.12.2026" })).toBe("Zahlbar bis 31.12.2026");
    expect(getT("fr")("does.not.exist")).toBe("does.not.exist");
  });

  it("ersetzt Platzhalter und lässt unbekannte stehen", () => {
    expect(interpolate("{a} und {b}", { a: 1 })).toBe("1 und {b}");
  });

  it("fr und it haben alle deutschen Basis-Schlüssel", () => {
    const keys = Object.keys(de);
    expect(keys.filter((k) => !(k in fr))).toEqual([]);
    expect(keys.filter((k) => !(k in itDict))).toEqual([]);
  });

  it("fr-Benachrichtigungen duzen durchgehend, Mail-Fusszeile nennt den echten Menüpfad", () => {
    const notifyFr = Object.entries(fr).filter(([k]) => k.startsWith("notify."));
    expect(notifyFr.filter(([, v]) => /\b(vous|votre|vos)\b/i.test(v)).map(([k]) => k)).toEqual([]);
    for (const dict of [de, fr, itDict]) {
      expect(dict["notify.mail.footerNoClub"]).toContain("Benachrichtigungen & Sprache");
      expect(dict["notify.mail.footerNoClub"]).not.toMatch(/Mein Konto|Mon compte|Il mio account/);
    }
    // Französische Guillemets mit geschütztem Leerzeichen
    expect(Object.values(fr).filter((v) => /«[^\u00A0]|[^\u00A0]»/.test(v))).toEqual([]);
  });

  it("liest verschiedene Exportformen von Zusatz-Wörterbüchern", () => {
    expect(pickExtra({ default: { de: { a: "x" } } })).toEqual({ de: { a: "x" } });
    expect(pickExtra({ de: { a: "x" }, fr: {} })).toEqual({ de: { a: "x" }, fr: {} });
    expect(pickExtra({ dict: { it: { a: "y" } } })).toEqual({ it: { a: "y" } });
    expect(pickExtra(null)).toEqual({});
  });

  it("Basis-Schlüssel haben Vorrang vor Zusätzen", () => {
    const merged = mergeDicts({ de: { a: "Basis" }, fr: {}, it: {} }, [{ de: { a: "Extra", b: "B" } }]);
    expect(merged.de).toEqual({ a: "Basis", b: "B" });
  });

  it("formatiert Datum und Betrag in Schweizer Zeit", () => {
    const d = new Date("2026-12-31T23:30:00Z"); // 1.1.2027 00:30 in Zürich
    expect(formatDate(d, "de")).toBe("01.01.2027");
    expect(formatMoneyLocale(12345, "de")).toMatch(/123\.45/);
  });
});
