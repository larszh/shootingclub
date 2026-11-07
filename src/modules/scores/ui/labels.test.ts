import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getT } from "@/lib/i18n/core";
import { scoreErrorText } from "./labels";

const src = ["sync.ts", "actions.ts"].map((f) => readFileSync(join(__dirname, "..", f), "utf8")).join("\n");

describe("scoreErrorText", () => {
  it("lässt Deutsch unverändert", () => {
    const t = getT("de");
    expect(scoreErrorText(t, "Nicht gefunden")).toBe("Nicht gefunden");
    expect(scoreErrorText(t, "Durchgang ist abgeschlossen.")).toBe("Durchgang ist abgeschlossen.");
  });

  it("übersetzt bekannte Meldungen", () => {
    expect(scoreErrorText(getT("fr"), "Durchgang ist abgeschlossen.")).toBe("La passe est terminée.");
    expect(scoreErrorText(getT("it"), "Keine Berechtigung")).toBe("Nessuna autorizzazione");
  });

  it("übersetzt die Meldung mit Eintragsnummer", () => {
    const msg = "Ungültiger Eintrag bei Nr. 4 (Zonenwert oder zu viele Schüsse) – bitte diesen Eintrag entfernen.";
    expect(scoreErrorText(getT("de"), msg)).toBe(msg);
    expect(scoreErrorText(getT("it"), msg)).toContain("n. 4");
  });

  it("gibt Unbekanntes und Leeres unverändert zurück", () => {
    expect(scoreErrorText(getT("fr"), "Irgendwas")).toBe("Irgendwas");
    expect(scoreErrorText(getT("fr"), undefined)).toBe("");
  });

  it("jede deutsche Übersetzung entspricht einer Meldung im Server-Code", () => {
    const de = getT("de");
    for (const key of ["notFound", "forbidden", "finished", "totalsOnly", "officialLocked", "officialOthers", "statusOfficialLocked", "reopenTotalsOnly", "deleteOfficial", "server", "otherAccount", "matchPending"]) {
      expect(src).toContain(de(`shooting.err.${key}`));
    }
    expect(src).toContain("Zonenwert oder zu viele Schüsse) – bitte diesen Eintrag entfernen.");
  });
});
