import { describe, expect, it } from "vitest";
import { buildJournal, cleanText, feeInvoiceKind, isPaidOnline, journalTotals, summarizeAccounts, type InvoiceDoc, type JournalEntry, type PaymentDoc } from "./journal";
import { ACCOUNT_LABEL, DEFAULT_ACCOUNTS } from "./types";

const A = DEFAULT_ACCOUNTS;
const YEAR = { from: "2026-01-01", to: "2026-12-31" };

function invoice(p: Partial<InvoiceDoc> = {}): InvoiceDoc {
  return {
    type: "invoice", source: "FEE", id: "inv1", number: "MB-2026-001", kind: "fee", label: "Mitgliederbeitrag 2026 Aktiv",
    amountCents: 12000, currency: "CHF", issuedAt: new Date("2026-02-01T09:00:00Z"), status: "OPEN",
    paidAt: null, paidOnline: false, refundedAt: null, cancelledAt: null, onlinePayments: [], ...p,
  };
}

const rows = (e: JournalEntry[]) => e.map((x) => [x.date, x.debit, x.credit, x.type]);
const balanceSum = (e: JournalEntry[]) => summarizeAccounts(e, A, ACCOUNT_LABEL).reduce((acc, x) => acc + x.balanceCents, 0);
const balanceOf = (e: JournalEntry[], account: string) => summarizeAccounts(e, A, ACCOUNT_LABEL).find((x) => x.account === account)?.balanceCents ?? 0;

describe("feeInvoiceKind", () => {
  it("erkennt Ersatzabgabe, Kiosk und Beitrag", () => {
    expect(feeInvoiceKind("Ersatzabgabe Arbeitsstunden 2026 (3 h)", false)).toBe("workfee");
    expect(feeInvoiceKind("  ersatzabgabe", false)).toBe("workfee");
    expect(feeInvoiceKind("Ersatzabgabe", true)).toBe("kiosk");
    expect(feeInvoiceKind("Aktivmitglied", false)).toBe("fee");
    // Rückfall über die Bezeichnung (nach dem Freigeben stornierter Kiosk-Rechnungen)
    expect(feeInvoiceKind("Schützenstube Oktober 2026", false)).toBe("kiosk");
  });
});

describe("buildJournal", () => {
  it("bucht offene Rechnung: Debitoren an Beiträge", () => {
    const e = buildJournal([invoice()], A, YEAR);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ date: "2026-02-01", doc: "MB-2026-001", debit: "1100", credit: "3000", amountCents: 12000, type: "issue" });
    expect(e[0]!.text).toBe("Rechnung MB-2026-001 Mitgliederbeitrag 2026 Aktiv");
  });

  it("bezahlte Rechnung: zusätzlich Bank an Debitoren am Zahlungsdatum", () => {
    const e = buildJournal([invoice({ status: "PAID", paidAt: new Date("2026-03-10T12:00:00Z") })], A, YEAR);
    expect(e.map((x) => [x.date, x.debit, x.credit, x.type])).toEqual([
      ["2026-02-01", "1100", "3000", "issue"],
      ["2026-03-10", "1020", "1100", "payment"],
    ]);
  });

  it("Datum in Schweizer Zeit (spätabends UTC = nächster Tag)", () => {
    const e = buildJournal([invoice({ issuedAt: new Date("2026-06-30T22:30:00Z") })], A, YEAR);
    expect(e[0]!.date).toBe("2026-07-01");
  });

  it("Stornierte Rechnung: Gegenbuchung am Stornodatum", () => {
    const e = buildJournal([invoice({ status: "CANCELLED", cancelledAt: new Date("2026-04-02T08:00:00Z") })], A, YEAR);
    expect(e.map((x) => [x.date, x.debit, x.credit, x.type])).toEqual([
      ["2026-02-01", "1100", "3000", "issue"],
      ["2026-04-02", "3000", "1100", "reversal"],
    ]);
    expect(e[1]!.text.startsWith("Storno ")).toBe(true);
  });

  it("Ertragskonto nach Art", () => {
    const docs: InvoiceDoc[] = [
      invoice({ id: "a", number: "A1", kind: "workfee" }),
      invoice({ id: "b", number: "A2", kind: "kiosk" }),
      invoice({ id: "c", number: "A3", kind: "booking", source: "BOOKING" }),
      invoice({ id: "d", number: "A4", kind: "ammo", source: "AMMO" }),
    ];
    expect(buildJournal(docs, A, YEAR).map((x) => x.credit)).toEqual(["3010", "3000", "3400", "3200"]);
  });

  it("verwendet den angepassten Kontenplan", () => {
    const e = buildJournal([invoice({ status: "PAID", paidAt: new Date("2026-02-05T10:00:00Z") })], { ...A, bankAccount: "1010", receivableAccount: "1105", feeAccount: "6000" }, YEAR);
    expect(e.map((x) => `${x.debit}/${x.credit}`)).toEqual(["1105/6000", "1010/1105"]);
  });

  it("Online bezahlte Rechnung: Zahlung aus Payment, nicht doppelt aus paidAt; Rückerstattung zurück", () => {
    const e = buildJournal([invoice({
      status: "PAID", paidAt: new Date("2026-02-03T10:00:00Z"), paidOnline: true,
      onlinePayments: [{ id: "p1", provider: "STRIPE", amountCents: 12000, currency: "CHF", paidAt: new Date("2026-02-03T10:00:00Z"), refundedAt: new Date("2026-02-20T10:00:00Z") }],
    })], A, YEAR);
    expect(rows(e)).toEqual([
      ["2026-02-01", "1100", "3000", "issue"],
      ["2026-02-03", "1020", "1100", "payment"],
      ["2026-02-20", "3000", "1020", "refund"],
    ]);
    expect(e[1]!.text).toContain("Online-Zahlung Stripe");
    // Nach Zahlung und Rückerstattung bleibt nichts offen: Debitoren, Ertrag und Bank auf null
    expect(["1100", "3000", "1020"].map((k) => balanceOf(e, k))).toEqual([0, 0, 0]);
  });

  it("doppelt bezahlt (Bank und online): beide Zahlungen, Guthaben auf Debitoren", () => {
    const e = buildJournal([invoice({
      status: "PAID", paidAt: new Date("2026-02-05T10:00:00Z"), paidOnline: false,
      onlinePayments: [{ id: "p1", provider: "WORLDLINE", amountCents: 12000, currency: "CHF", paidAt: new Date("2026-02-06T10:00:00Z"), refundedAt: null }],
    })], A, YEAR);
    expect(rows(e)).toEqual([
      ["2026-02-01", "1100", "3000", "issue"],
      ["2026-02-05", "1020", "1100", "payment"],
      ["2026-02-06", "1020", "1100", "payment"],
    ]);
    expect(balanceOf(e, "1100")).toBe(-12000);
  });

  it("per Bank bezahlte, später erstattete Rechnung (Reservation): Ertrag an Bank", () => {
    const e = buildJournal([invoice({ source: "BOOKING", kind: "booking", status: "PAID", paidAt: new Date("2026-02-04T10:00:00Z"), refundedAt: new Date("2026-03-01T10:00:00Z") })], A, YEAR);
    expect(rows(e)).toEqual([
      ["2026-02-01", "1100", "3400", "issue"],
      ["2026-02-04", "1020", "1100", "payment"],
      ["2026-03-01", "3400", "1020", "refund"],
    ]);
    expect(["1100", "3400", "1020"].map((k) => balanceOf(e, k))).toEqual([0, 0, 0]);
  });

  it("online bezahlt, storniert und erstattet: Guthaben wird ausbezahlt (Debitoren an Bank)", () => {
    const e = buildJournal([invoice({
      status: "CANCELLED", cancelledAt: new Date("2026-02-10T10:00:00Z"),
      onlinePayments: [{ id: "p1", provider: "STRIPE", amountCents: 12000, currency: "CHF", paidAt: new Date("2026-02-03T10:00:00Z"), refundedAt: new Date("2026-02-12T10:00:00Z") }],
    })], A, YEAR);
    expect(rows(e)).toEqual([
      ["2026-02-01", "1100", "3000", "issue"],
      ["2026-02-03", "1020", "1100", "payment"],
      ["2026-02-10", "3000", "1100", "reversal"],
      ["2026-02-12", "1100", "1020", "refund"],
    ]);
    expect(["1100", "3000", "1020"].map((k) => balanceOf(e, k))).toEqual([0, 0, 0]);
  });

  it("Rückerstattung nur bei bezahlter Rechnung", () => {
    expect(buildJournal([invoice({ refundedAt: new Date("2026-03-01T10:00:00Z") })], A, YEAR).map((x) => x.type)).toEqual(["issue"]);
  });

  it("Online-Zahlung ohne Rechnung: Bank an Reservationen", () => {
    const p: PaymentDoc = {
      type: "payment", source: "ONLINE", id: "pay1", number: "ONL-ABCDEF12", kind: "booking", label: "Reservation Stand 1 14.03.2026",
      payment: { id: "pay1", provider: "SUMUP", amountCents: 4500, currency: "CHF", paidAt: new Date("2026-03-01T10:00:00Z"), refundedAt: null },
    };
    const e = buildJournal([p], A, YEAR);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ debit: "1020", credit: "3400", amountCents: 4500, doc: "ONL-ABCDEF12", source: "ONLINE" });
    const r = buildJournal([{ ...p, payment: { ...p.payment, refundedAt: new Date("2026-03-05T10:00:00Z") } }], A, YEAR);
    expect(r.map((x) => `${x.debit}/${x.credit}/${x.type}`)).toEqual(["1020/3400/payment", "3400/1020/refund"]);
  });

  it("filtert nach Periode (beide Grenzen inklusive)", () => {
    const doc = invoice({ issuedAt: new Date("2025-12-20T10:00:00Z"), status: "PAID", paidAt: new Date("2026-01-01T00:30:00Z") });
    const e = buildJournal([doc], A, { from: "2026-01-01", to: "2026-01-31" });
    expect(e.map((x) => x.type)).toEqual(["payment"]);
    expect(buildJournal([doc], A, { from: "2025-12-20", to: "2025-12-20" }).map((x) => x.type)).toEqual(["issue"]);
  });

  it("überspringt Nullbeträge und Rechnungen ohne Ausstellungsdatum", () => {
    expect(buildJournal([invoice({ amountCents: 0, status: "PAID", paidAt: new Date("2026-02-02") }), invoice({ id: "x", issuedAt: null })], A, YEAR)).toEqual([]);
  });

  it("sortiert nach Datum, Beleg (numerisch) und Buchungsart", () => {
    const e = buildJournal([
      invoice({ id: "2", number: "MB-10" }),
      invoice({ id: "1", number: "MB-9", status: "PAID", paidAt: new Date("2026-02-01T15:00:00Z") }),
    ], A, YEAR);
    expect(e.map((x) => `${x.doc}:${x.type}`)).toEqual(["MB-9:issue", "MB-9:payment", "MB-10:issue"]);
  });

  it("bereinigt Texte (Tabs, Zeilenumbrüche, Länge)", () => {
    expect(cleanText("Mitglieder\tbeitrag\r\n 2026  ")).toBe("Mitglieder beitrag 2026");
    const long = cleanText("x".repeat(300));
    expect(long.length).toBe(191);
    expect(long.endsWith("…")).toBe(true);
    const e = buildJournal([invoice({ label: "Zeile1\nZeile2" })], A, YEAR);
    expect(e[0]!.text).not.toMatch(/[\n\t]/);
  });
});

describe("isPaidOnline", () => {
  it("nur wenn die Verbuchung nahe beim Bezahlt-Datum liegt", () => {
    const paid = new Date("2026-02-03T10:00:00Z");
    expect(isPaidOnline(paid, [new Date("2026-02-03T10:00:01Z")])).toBe(true);
    expect(isPaidOnline(paid, [new Date("2026-02-04T10:00:00Z")])).toBe(false);
    expect(isPaidOnline(null, [paid])).toBe(false);
    expect(isPaidOnline(paid, [])).toBe(false);
  });
});

describe("summarizeAccounts", () => {
  it("Saldo pro Konto: Soll minus Haben, sortiert", () => {
    const entries = buildJournal([
      invoice({ status: "PAID", paidAt: new Date("2026-02-10T10:00:00Z") }),
      invoice({ id: "2", number: "MB-2026-002", amountCents: 8000 }),
      invoice({ id: "3", number: "MU-1", source: "AMMO", kind: "ammo", amountCents: 3000 }),
    ], A, YEAR);
    const s = summarizeAccounts(entries, A, ACCOUNT_LABEL);
    expect(s.map((x) => [x.account, x.balanceCents])).toEqual([
      ["1020", 12000],
      ["1100", 11000],
      ["3000", -20000],
      ["3200", -3000],
    ]);
    expect(s.find((x) => x.account === "1100")).toMatchObject({ debitCents: 23000, creditCents: 12000, names: ["Debitoren"] });
    // Doppelte Buchhaltung: Summe aller Salden ist null
    expect(balanceSum(entries)).toBe(0);
    expect(journalTotals(entries)).toEqual([{ currency: "CHF", cents: 35000 }]);
  });

  it("fasst Bezeichnungen zusammen, wenn sich Rollen ein Konto teilen", () => {
    const plan = { ...A, workFeeAccount: "3000" };
    const entries = buildJournal([invoice({ kind: "workfee" })], plan, YEAR);
    const s = summarizeAccounts(entries, plan, ACCOUNT_LABEL);
    expect(s.find((x) => x.account === "3000")!.names).toEqual(["Mitgliederbeiträge", "Ersatzabgabe Arbeitsstunden"]);
  });
});
