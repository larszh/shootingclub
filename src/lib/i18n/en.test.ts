import { describe, expect, it } from "vitest";
import de from "./de";
import en from "./en";
import platform from "./extra/platform";
import members from "./extra/members";
import ops from "./extra/ops";
import shell from "./extra/shell";
import money from "./extra/money";
import shooting from "./extra/shooting";
import bookings from "./extra/bookings";
import { formatDate, formatMoneyLocale, getT, INTL_LOCALE, normalizeLocale } from "./core";

type Pair = { de: Record<string, string>; en: Record<string, string> };

/** Wörterbücher, die vor Welle E bestanden und jetzt vollständig Englisch haben müssen. */
const DICTS: Record<string, Pair> = {
  base: { de, en },
  platform,
  members,
  ops,
  shell,
  money,
  shooting,
  bookings,
};

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

/** Texte, die auf Englisch gleich lauten dürfen wie auf Deutsch (Namen, Kürzel, Platzhalter, gleiche Wörter). */
const SAME_WORDS = new Set([
  "OK", "Okay", "Chat", "Live", "Import", "Export", "System", "Admin", "Trainer", "Training", "Total", "Check-in", "Standchef",
  "Tox Info", "Offline", "Global", "Status", "Name", "Tenants", "Online", "Podium", "Pause", "Start", "Code",
]);
/** Nur Platzhalter, Zahlen, Satzzeichen und Kürzel (z.B. «{n} h», «Ref. {ref}», «max. {max}»). */
const NEUTRAL = /^(?:\{\w+\}|[\s\d–\-·+%×/.:,()Ø]|h|s|in|vs|max|Ref|IBAN|Version|Bonus|offline)*$/u;
const isSameOk = (v: string) => SAME_WORDS.has(v.trim()) || NEUTRAL.test(v) || /^\d · Details/.test(v);

describe("Englisch (en)", () => {
  for (const [name, d] of Object.entries(DICTS)) {
    it(`${name}: jeder deutsche Schlüssel hat einen englischen Text, keine zusätzlichen`, () => {
      expect(Object.keys(d.de).filter((k) => !(k in d.en))).toEqual([]);
      expect(Object.keys(d.en).filter((k) => !(k in d.de))).toEqual([]);
      expect(Object.entries(d.en).filter(([k, v]) => !v.trim() && d.de[k]!.trim()).map(([k]) => k)).toEqual([]);
    });

    it(`${name}: Platzhalter wie auf Deutsch, englische Anführungszeichen`, () => {
      expect(Object.keys(d.de).filter((k) => placeholders(d.de[k]!) !== placeholders(d.en[k] ?? ""))).toEqual([]);
      expect(Object.entries(d.en).filter(([, v]) => /[«»]/.test(v)).map(([k]) => k)).toEqual([]);
      expect(Object.entries(d.en).filter(([, v]) => /[äöüÄÖÜß]/.test(v) && !/Schützengesellschaft|Zürich/.test(v)).map(([k]) => k)).toEqual([]);
    });

    it(`${name}: Texte sind übersetzt (nicht einfach deutsch übernommen)`, () => {
      const same = Object.keys(d.de).filter((k) => d.en[k] === d.de[k] && !isSameOk(d.de[k]!));
      expect(same).toEqual([]);
    });
  }

  it("Schweizer Begriffe", () => {
    const t = getT("en");
    expect(t("shooting.officialKind.OP")).toBe("Obligatory programme");
    expect(t("shooting.officialKind.FS")).toBe("Field shooting");
    expect(t("shell.nav.federal")).toBe("Federal exercises");
    expect(t("shell.admin.members")).toBe("Members");
    expect(t("invoice.title")).toBe("Invoice");
    expect(t("locale.en")).toBe("English");
    // Mail-Fusszeile nennt den Menüpfad so, wie die App ihn auf Englisch zeigt
    expect(t("notify.mail.footer")).toContain(`${t("shell.nav.more")} → ${t("shell.me.row.notifications")}`);
  });

  it("Sprache und Formate", () => {
    expect(normalizeLocale("en-US")).toBe("en");
    expect(INTL_LOCALE.en).toBe("en-CH");
    expect(formatDate(new Date("2026-11-07T10:00:00Z"), "en")).toMatch(/07.11.2026/);
    expect(formatMoneyLocale(1250, "en")).toMatch(/CHF\s?12\.50/);
    expect(getT("en")("invoice.payableUntil", { date: "31.12.2026" })).toBe("Payable by 31.12.2026");
  });
});
