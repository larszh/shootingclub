import { describe, expect, it } from "vitest";
import de from "./de";
import fr from "./fr";
import itDict from "./it";
import en from "./en";
import { afterEach } from "vitest";
import { allDictionaryKeys, baseText, formatDate, formatMoneyLocale, getOverrides, getT, interpolate, lookup, mergeDicts, normalizeLocale, pickExtra, setOverrides } from "./core";

describe("i18n core", () => {
  it("normalisiert Sprachen", () => {
    expect(normalizeLocale("fr-CH")).toBe("fr");
    expect(normalizeLocale("IT")).toBe("it");
    expect(normalizeLocale("en-GB")).toBe("en");
    expect(normalizeLocale("rm")).toBe("de");
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

  it("fr, it und en haben alle deutschen Basis-Schlüssel", () => {
    const keys = Object.keys(de);
    expect(keys.filter((k) => !(k in en))).toEqual([]);
    expect(Object.keys(en).filter((k) => !(k in de))).toEqual([]);
    expect(keys.filter((k) => !(k in fr))).toEqual([]);
    expect(keys.filter((k) => !(k in itDict))).toEqual([]);
  });

  it("fr-Benachrichtigungen duzen durchgehend, Mail-Fusszeile nennt den echten Menüpfad", () => {
    const notifyFr = Object.entries(fr).filter(([k]) => k.startsWith("notify."));
    expect(notifyFr.filter(([, v]) => /\b(vous|votre|vos)\b/i.test(v)).map(([k]) => k)).toEqual([]);
    // Jede Sprache nennt die Menüpunkte so, wie die App sie in dieser Sprache zeigt (extra/shell.ts).
    for (const [dict, path] of [[de, "Mehr → Benachrichtigungen & Sprache"], [fr, "Plus → Notifications & langue"], [itDict, "Altro → Notifiche e lingua"], [en, "More → Notifications & language"]] as const) {
      expect(dict["notify.mail.footerNoClub"]).toContain(path);
      expect(dict["notify.mail.footer"]).toContain(path);
      expect(dict["notify.mail.footerNoClub"]).not.toMatch(/Mein Konto|Mon compte|Il mio account|My account/);
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
    const merged = mergeDicts({ de: { a: "Basis" }, fr: {}, it: {}, en: {} }, [{ de: { a: "Extra", b: "B" } }]);
    expect(merged.de).toEqual({ a: "Basis", b: "B" });
  });

  it("formatiert Datum und Betrag in Schweizer Zeit", () => {
    const d = new Date("2026-12-31T23:30:00Z"); // 1.1.2027 00:30 in Zürich
    expect(formatDate(d, "de")).toBe("01.01.2027");
    expect(formatMoneyLocale(12345, "de")).toMatch(/123\.45/);
  });

  describe("Übersteuerungen und Englisch", () => {
    afterEach(() => setOverrides({}));

    it("en fällt auf Deutsch zurück, solange kein englischer Text existiert", () => {
      expect(getT("en")("does.not.exist")).toBe("does.not.exist");
      const de = getT("de")("invoice.title");
      const en = getT("en")("invoice.title");
      expect(en === de || en === baseText("en", "invoice.title")).toBe(true);
    });

    it("Übersteuerung hat Vorrang und wirkt auch auf bereits erzeugte Übersetzer", () => {
      const t = getT("fr");
      setOverrides({ fr: { "invoice.title": "Facture {n}" } });
      expect(t("invoice.title", { n: 1 })).toBe("Facture 1");
      expect(lookup("fr", "invoice.title")).toBe("Facture {n}");
      expect(baseText("fr", "invoice.title")).toBe("Facture");
    });

    it("deutsche Übersteuerung dient als Rückfall für fehlende Sprachen", () => {
      setOverrides({ de: { "x.only.de": "Nur DE" } });
      expect(getT("it")("x.only.de")).toBe("Nur DE");
    });

    it("leere Texte werden ignoriert, setOverrides ersetzt alles", () => {
      setOverrides({ de: { a: "" }, fr: { b: "B" } });
      expect(getOverrides()).toEqual({ fr: { b: "B" } });
      setOverrides({});
      expect(getOverrides()).toEqual({});
    });

    it("allDictionaryKeys enthält die Basis-Schlüssel sortiert", () => {
      const keys = allDictionaryKeys();
      expect(keys).toContain("invoice.title");
      expect([...keys].sort()).toEqual(keys);
    });
  });
});
