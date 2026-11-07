import { describe, expect, it } from "vitest";
import { partnerInvoiceItem, partnerInvoiceWhere, partnerPaymentItem, toPaymentPayee } from "./partner-items";

const now = new Date("2026-11-06T10:00:00Z");
const issuer = { tenantId: "owner", name: "SV Partnerdorf" };
const payee = { iban: "CH4431999123000889012", payeeName: "SV Partnerdorf", qrIban: true };
const inv = {
  id: "inv1", tenantId: "owner", number: "R-2026-0007", amountCents: 3000, currency: "CHF", status: "OPEN",
  issuedAt: new Date("2026-10-01T10:00:00Z"), dueAt: new Date("2026-10-31T10:00:00Z"), paidAt: null,
  bookingId: "b1", booking: { startsAt: new Date("2026-10-05T16:00:00Z"), resource: { name: "300 m" } },
};

describe("Partner-Rechnungen unter «Zahlungen»", () => {
  it("nur eigene Buchungen über den aktiven Verein bei einem anderen Eigentümer", () => {
    expect(partnerInvoiceWhere("guest", "u1")).toEqual({ tenantId: { not: "guest" }, booking: { userId: "u1", viaTenantId: "guest" } });
    expect(partnerInvoiceWhere("guest", "u1", { status: "OPEN" })).toMatchObject({ status: "OPEN" });
  });

  it("Rechnung des Eigentümers mit dessen Zahlungsangaben", () => {
    const item = partnerInvoiceItem(inv, issuer, payee, "210000000003139471430009017", now);
    expect(item).toMatchObject({
      key: "BOOKING:inv1", source: "BOOKING", status: "OPEN", group: "open", overdue: true,
      title: "Reservation 300 m", detail: "Termin 05.10.2026 · SV Partnerdorf",
      reference: "210000000003139471430009017", href: "/bookings/b1/invoice", issuer, payee,
    });
  });

  it("ohne QR-IBAN des Eigentümers keine Referenz", () => {
    const item = partnerInvoiceItem({ ...inv, status: "PAID", paidAt: now }, issuer, { ...payee, qrIban: false }, "210000000003139471430009017", now);
    expect(item).toMatchObject({ reference: null, status: "PAID", group: "paid", overdue: false });
  });

  it("Online-Zahlung einer Partner-Buchung", () => {
    const p = {
      id: "p1", provider: "PAYREXX", status: "REFUNDED", amountCents: 3000, currency: "CHF", createdAt: now, updatedAt: now, bookingId: "b1",
      booking: { tenantId: "owner", paidAt: now, startsAt: new Date("2026-10-05T16:00:00Z"), resource: { name: "300 m" } },
    };
    expect(partnerPaymentItem(p, issuer)).toMatchObject({ source: "ONLINE", status: "REFUNDED", group: "other", paidAt: null, issuer });
    expect(partnerPaymentItem({ ...p, booking: null }, issuer)).toBeNull();
  });

  it("Zahlungsangaben aus dem Rechnungsprofil", () => {
    expect(toPaymentPayee({ payeeName: null, payeeStreet: null, payeeZip: null, payeeCity: null, iban: "CH93", currency: "CHF", qrReady: false, qrIban: false }, "SV X"))
      .toEqual({ iban: "CH93", payeeName: "SV X", qrIban: false });
  });
});
