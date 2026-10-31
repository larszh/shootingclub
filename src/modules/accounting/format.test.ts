import { describe, expect, it, vi } from "vitest";

// Der gemeinsame CSV-Helfer liegt neben der Export-Absicherung (Session, Tenant); für die reine
// Formatierung werden diese Abhängigkeiten ersetzt.
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/tenant", () => ({ getAppContext: vi.fn() }));

import { bananaCell, exportFilename, formatAmount, renderBanana, renderBexio, renderGenericCsv, renderJournal } from "./format";
import type { JournalEntry } from "./journal";

function entry(p: Partial<JournalEntry> = {}): JournalEntry {
  return {
    date: "2026-03-05", doc: "MB-2026-001", text: "Rechnung MB-2026-001 Mitgliederbeitrag 2026 Aktiv",
    debit: "1100", credit: "3000", amountCents: 12000, currency: "CHF", source: "FEE", kind: "fee", type: "issue", docId: "x", ...p,
  };
}

describe("formatAmount", () => {
  it("zwei Dezimalen mit Punkt", () => {
    expect(formatAmount(12000)).toBe("120.00");
    expect(formatAmount(5)).toBe("0.05");
    expect(formatAmount(123456789)).toBe("1234567.89");
  });
});

describe("renderBanana", () => {
  it("Kopfzeile und Zeilen mit Tabulatoren, Datum TT.MM.JJJJ, CRLF", () => {
    const out = renderBanana([entry(), entry({ date: "2026-12-31", doc: "MU-7", text: "Zahlung MU-7 Munition", debit: "1020", credit: "1100", amountCents: 3050 })]);
    const lines = out.split("\r\n");
    expect(lines[0]).toBe("Datum\tBeleg\tBeschreibung\tKtSoll\tKtHaben\tBetrag");
    expect(lines[1]).toBe("05.03.2026\tMB-2026-001\tRechnung MB-2026-001 Mitgliederbeitrag 2026 Aktiv\t1100\t3000\t120.00");
    expect(lines[2]).toBe("31.12.2026\tMU-7\tZahlung MU-7 Munition\t1020\t1100\t30.50");
    expect(lines[3]).toBe("");
    expect(out.startsWith("﻿")).toBe(false);
    expect(lines[1]!.split("\t")).toHaveLength(6);
  });

  it("entfernt Tabs und Umbrüche in Feldern und entschärft Formeln", () => {
    expect(bananaCell("a\tb\nc")).toBe("a b c");
    expect(bananaCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(bananaCell("-12.50")).toBe("-12.50");
    const out = renderBanana([entry({ text: "@evil\tx" })]);
    expect(out.split("\r\n")[1]!.split("\t")[2]).toBe("'@evil x");
  });
});

describe("renderBexio", () => {
  it("Semikolon-CSV mit BOM und bexio-Spalten", () => {
    const out = renderBexio([entry()]);
    expect(out.startsWith("﻿")).toBe(true);
    const lines = out.slice(1).split("\r\n");
    expect(lines[0]).toBe("Datum;Beleg;Text;Soll;Haben;Betrag");
    expect(lines[1]).toBe("05.03.2026;MB-2026-001;Rechnung MB-2026-001 Mitgliederbeitrag 2026 Aktiv;1100;3000;120.00");
  });

  it("maskiert Semikolon und Anführungszeichen, schützt vor Formel-Injection", () => {
    const out = renderBexio([entry({ text: 'Beitrag; «Aktiv» "A"' }), entry({ text: "=HYPERLINK(1)" })]);
    const lines = out.slice(1).split("\r\n");
    expect(lines[1]).toContain(';"Beitrag; «Aktiv» ""A""";');
    expect(lines[2]).toContain(";'=HYPERLINK(1);");
  });
});

describe("renderGenericCsv", () => {
  it("enthält Zusatzspalten", () => {
    const lines = renderGenericCsv([entry({ type: "payment", source: "ONLINE", kind: "booking" })]).slice(1).split("\r\n");
    expect(lines[0]).toBe("Datum;Beleg;Text;Soll;Haben;Betrag;Währung;Bereich;Art;Buchungsart");
    expect(lines[1]!.endsWith(";120.00;CHF;Online-Zahlungen;Reservation;Zahlung")).toBe(true);
  });

  it("leeres Journal: nur Kopfzeile", () => {
    expect(renderJournal("csv", []).slice(1)).toBe("Datum;Beleg;Text;Soll;Haben;Betrag;Währung;Bereich;Art;Buchungsart\r\n");
    expect(renderJournal("banana", [])).toBe("Datum\tBeleg\tBeschreibung\tKtSoll\tKtHaben\tBetrag\r\n");
  });
});

describe("exportFilename", () => {
  it("Endung je Format", () => {
    expect(exportFilename("banana", "sg-musterhausen", "2026-01-01", "2026-12-31")).toBe("buchungen-sg-musterhausen-2026-01-01-2026-12-31-banana.txt");
    expect(exportFilename("bexio", "", "2026-01-01", "2026-03-31")).toBe("buchungen-verein-2026-01-01-2026-03-31-bexio.csv");
  });
});
