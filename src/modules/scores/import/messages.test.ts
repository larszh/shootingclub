import { describe, expect, it } from "vitest";
import { getT } from "@/lib/i18n/core";
import { localizeImportMessage } from "./messages";

/** Meldungen, wie sie parse.ts, shooters.ts und plan.ts erzeugen. */
const SAMPLES = [
  "Die Datei ist leer.",
  "Die Datei ist grösser als 5 MB. Bitte in mehrere Dateien aufteilen.",
  "Das sieht nicht nach einer Text- oder CSV-Datei aus. Bitte den Export als CSV oder TXT speichern.",
  "Die Datei enthält keine Datenzeilen (erste Zeile = Spaltennamen).",
  "Zu viele Zeilen (60000). Höchstens 50000 pro Import.",
  "Bitte eine Spalte als «Schusswert» zuordnen.",
  "Bitte Spalten als «Serientotal», «Total» oder «Schusswert» zuordnen.",
  "Zu viele Schützen (höchstens 500 pro Import).",
  "Zeile 4: Serie «abc» nicht lesbar",
  "Zeile 2: Schusswert «zehn» nicht lesbar",
  "Zeile 7: Serientotal «x» nicht lesbar",
  "Schuss 2 (Serie 1) kommt mehrfach vor (Zeile 4)",
  "Schuss 2 kommt mehrfach vor (Zeile 4)",
  "Serientotal fehlt",
  "Zeile 3: Serie 0 ungültig",
  "Serie 2 kommt mehrfach vor (Zeile 5)",
  "Mehrere Zeilen für denselben Schützen (Zeile 6) – bei einer Zeile pro Schuss bitte «Zeile pro Schuss» wählen",
  "Keine Schützen mit Resultaten gefunden. Bitte Spaltenzuordnung und Aufbau prüfen.",
  "Serie 1: Wert 7 passt zu keiner Zone",
  "Serie 1: negativer Wert -1",
  "Serie 2: Wert 11 über dem Maximum 10",
  "Total: negativer Wert",
  "Serientotal: 120 über dem Maximum 100",
  "Total: Zehntelwert 95.4, das Programm wertet ganze Zahlen",
  "Programm ohne Serien",
  "3 Schüsse ohne Serienangabe",
  "4 Serien in der Datei, das Programm hat 2",
  "5 Schüsse, das Programm hat 4",
  "Serie 2 («Schnellfeuer»): keine Schüsse",
  "Serie 1: 6 Schüsse, erlaubt sind 5",
  "Serie 1: 3 von 5 Schüssen",
  "Serie 2: kein Total",
  "Zehntelwerte auf ganze Ringe abgerundet",
  "Total in der Datei 190, aus den Schüssen berechnet 193",
  "Total in der Datei 190, Summe der Serien 193",
  "1 Probeschuss nicht übernommen",
  "3 Probeschüsse nicht übernommen",
  "Nur das Gesamttotal ist bekannt – es wird bei Serie 1 gespeichert",
  "Keine Resultate",
  "Mitglied ist mehreren Schützen zugeordnet",
  "Programm wählen",
  "Mitglied nicht (mehr) im Verein",
  "Startnr. 12 · SG Musterhausen",
  "Startnr. 7",
];

describe("localizeImportMessage", () => {
  it("reproduces every German message exactly", () => {
    const t = getT("de");
    for (const m of SAMPLES) expect(localizeImportMessage(m, t)).toBe(m);
  });

  it("translates every known message into French, Italian and English", () => {
    for (const l of ["fr", "it", "en"] as const) {
      const t = getT(l);
      for (const m of SAMPLES) {
        const out = localizeImportMessage(m, t);
        expect(out, `${l}: ${m}`).not.toBe(m);
        expect(out, `${l}: ${m}`).not.toContain("aicoach.");
      }
    }
  });

  it("keeps values and translates nested parts", () => {
    expect(localizeImportMessage("Zeile 7: Serientotal «x» nicht lesbar", getT("en"))).toBe("Row 7: Series total “x” not readable");
    expect(localizeImportMessage("Serie 2: Wert 11 über dem Maximum 10", getT("en"))).toBe("Series 2: Value 11 above the maximum 10");
    expect(localizeImportMessage("Startnr. 12 · SG Musterhausen", getT("it"))).toBe("N. di partenza 12 · SG Musterhausen");
  });

  it("leaves unknown messages unchanged", () => {
    expect(localizeImportMessage("Etwas ganz anderes", getT("fr"))).toBe("Etwas ganz anderes");
  });
});
