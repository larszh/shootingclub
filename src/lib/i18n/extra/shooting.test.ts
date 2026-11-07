import { describe, expect, it } from "vitest";
import shooting, { frTypography } from "./shooting";
import { getT } from "../core";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("Wörterbuch shooting", () => {
  const de = shooting.de;
  const keys = Object.keys(de);

  it("hat nur Schlüssel im Namensraum «shooting.»", () => {
    expect(keys.length).toBeGreaterThan(300);
    expect(keys.filter((k) => !k.startsWith("shooting."))).toEqual([]);
  });

  it("fr, it und en haben jeden deutschen Schlüssel (und keine zusätzlichen), alle Texte gefüllt", () => {
    for (const other of [shooting.fr, shooting.it, shooting.en]) {
      expect(keys.filter((k) => !(k in other))).toEqual([]);
      expect(Object.keys(other).filter((k) => !(k in de))).toEqual([]);
      expect(Object.entries(other).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
    }
    expect(Object.entries(de).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });

  it("Platzhalter stimmen in allen Sprachen überein", () => {
    const mismatches: string[] = [];
    for (const k of keys) {
      const want = placeholders(de[k]!);
      for (const [lang, d] of [["fr", shooting.fr], ["it", shooting.it], ["en", shooting.en]] as const) {
        if (JSON.stringify(placeholders(d[k] ?? "")) !== JSON.stringify(want)) mismatches.push(`${lang}:${k}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("Einzahl und Mehrzahl kommen paarweise vor", () => {
    const ones = keys.filter((k) => k.endsWith(".one")).map((k) => k.slice(0, -4));
    const others = keys.filter((k) => k.endsWith(".other")).map((k) => k.slice(0, -6));
    expect(ones.sort()).toEqual(others.sort());
  });

  it("Französisch: schmale geschützte Leerzeichen, Anrede mit «tu»", () => {
    const fr = Object.entries(shooting.fr);
    expect(fr.filter(([, v]) => /«[^ ]|[^ ]»/.test(v)).map(([k]) => k)).toEqual([]);
    expect(fr.filter(([, v]) => / [!?;:]/.test(v)).map(([k]) => k)).toEqual([]);
    expect(fr.filter(([, v]) => /\b(vous|votre|vos)\b/i.test(v)).map(([k]) => k)).toEqual([]);
    expect(frTypography("Pénalités : « Test » ?")).toBe("Pénalités : « Test » ?");
  });

  it("Schweizer Begriffe: kein ß, Verein = société / società", () => {
    for (const d of [shooting.de, shooting.fr, shooting.it]) expect(Object.values(d).filter((v) => v.includes("ß"))).toEqual([]);
    expect(Object.values(shooting.fr).filter((v) => /\bclub\b/i.test(v.replace(/\{club\}/g, "")))).toEqual([]);
    expect(shooting.fr["shooting.setup.noMembers"]).toContain("société");
    expect(shooting.it["shooting.setup.noMembers"]).toContain("società");
  });

  it("ist über getT erreichbar, Deutsch unverändert", () => {
    expect(getT("de")("shooting.shifts.title")).toBe("Helfereinsätze");
    expect(getT("fr")("shooting.champ.myStanding")).toBe("Mon classement");
    expect(getT("it")("shooting.checkin.title")).toBe("Check-in");
    expect(getT("en")("shooting.officialKind.OP")).toBe("Obligatory programme");
    expect(getT("en")("shooting.officialKind.FS")).toBe("Field shooting");
    expect(getT("de")("shooting.entry.finish")).toBe("Durchgang abschliessen");
    expect(getT("fr")("shooting.shifts.staffing", { filled: 2, capacity: 4 })).toBe("2 sur 4");
  });

  it("Standbetrieb (Übersicht, Vorfälle, Standbuch, Halbtage) ist in allen Sprachen vorhanden, Deutsch unverändert", () => {
    const required = [
      "shooting.range.wholeFacility", "shooting.range.openLogs", "shooting.range.newLog", "shooting.range.stale.one", "shooting.range.stale.other",
      "shooting.range.lastClosed", "shooting.range.memberCheckin", "shooting.range.qrText", "shooting.range.print", "shooting.range.dutyWarning",
      "shooting.range.responsibility", "shooting.incident.kind.ACCIDENT", "shooting.incident.kind.NEAR_MISS", "shooting.incident.kind.DAMAGE",
      "shooting.incident.kind.OTHER", "shooting.incident.severity.LOW", "shooting.incident.severity.MEDIUM", "shooting.incident.severity.HIGH",
      "shooting.incident.status.OPEN", "shooting.incident.status.CLOSED", "shooting.incident.hint", "shooting.incident.new",
      "shooting.incident.field.description", "shooting.incident.field.locationHint", "shooting.incident.submit", "shooting.incident.msg.reported",
      "shooting.incident.msg.reportedThanks", "shooting.incident.msg.tooLong", "shooting.log.subtitle", "shooting.log.legend", "shooting.log.flagLetters",
      "shooting.log.empty.text", "shooting.quota.title", "shooting.quota.footer", "shooting.quota.ofMax", "shooting.quota.col.month",
    ];
    for (const d of [shooting.de, shooting.fr, shooting.it]) expect(required.filter((k) => !d[k]?.trim())).toEqual([]);
    for (const k of ["shooting.range.openLogs", "shooting.incident.hint", "shooting.incident.submit", "shooting.log.legend", "shooting.quota.footer"]) {
      expect(shooting.fr[k]).not.toBe(shooting.de[k]);
      expect(shooting.it[k]).not.toBe(shooting.de[k]);
    }
    // Deutsch wie vorher fest im Code
    expect(getT("de")("shooting.range.stale.other", { n: 2 })).toBe("2 Standbücher früherer Tage sind noch offen. Bitte abschliessen:");
    expect(getT("de")("shooting.incident.hint")).toBe("Bei Unfällen zuerst Notruf, dann Versicherung (z.B. USS) gemäss deren Vorgaben melden.");
    expect(getT("de")("shooting.log.subtitle", { days: 3, visits: 12 })).toBe("3 Schiesstage · 12 Besuche");
    expect(getT("fr")("shooting.incident.kind.NEAR_MISS")).toBe("Quasi-accident");
    expect(getT("it")("shooting.quota.remaining", { n: 4 })).toBe("4 rimanenti");
    // Kurzbuchstaben der Halbtage: genau drei, durch Leerzeichen getrennt
    for (const d of [shooting.de, shooting.fr, shooting.it, shooting.en]) expect(d["shooting.log.flagLetters"]!.split(" ")).toHaveLength(3);
  });
});
