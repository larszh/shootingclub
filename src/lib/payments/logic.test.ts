import { describe, expect, it } from "vitest";
import {
  amountMatches,
  assertOnlinePayable,
  canPayFeeInvoiceOnline,
  feeInvoiceSettlement,
  isOnlinePayableKind,
  NotOnlinePayableError,
  onlinePaymentNote,
  settlementDecision,
  sourceAllowsOnlinePayment,
  paymentDetailsJson,
  paymentReviewBadge,
  paymentReviewFromDetails,
} from "./logic";

describe("Munition nie online", () => {
  it("assertOnlinePayable wirft für AMMO und Unbekanntes", () => {
    expect(() => assertOnlinePayable("AMMO")).toThrow(NotOnlinePayableError);
    expect(() => assertOnlinePayable("AMMO")).toThrow(/Munition/);
    expect(() => assertOnlinePayable("AMMO_ORDER")).toThrow(NotOnlinePayableError);
    expect(() => assertOnlinePayable("")).toThrow(NotOnlinePayableError);
    expect(() => assertOnlinePayable("BOOKING")).not.toThrow();
    expect(() => assertOnlinePayable("FEE_INVOICE")).not.toThrow();
    expect(isOnlinePayableKind("AMMO")).toBe(false);
  });
  it("Zahlungsübersicht: nur Beitragsrechnungen erhalten «Online bezahlen»", () => {
    expect(sourceAllowsOnlinePayment("FEE")).toBe(true);
    expect(sourceAllowsOnlinePayment("AMMO")).toBe(false);
    expect(sourceAllowsOnlinePayment("BOOKING")).toBe(false);
    expect(sourceAllowsOnlinePayment("ONLINE")).toBe(false);
  });
});

describe("Betrag und Währung", () => {
  const exp = { amountCents: 8000, currency: "CHF" };
  it("muss exakt passen, Währung ohne Gross/Klein", () => {
    expect(amountMatches(exp, { amountCents: 8000, currency: "chf" })).toBe(true);
    expect(amountMatches(exp, { amountCents: 7999, currency: "CHF" })).toBe(false);
    expect(amountMatches(exp, { amountCents: 8000, currency: "EUR" })).toBe(false);
    expect(amountMatches(exp, { amountCents: null, currency: "CHF" })).toBe(false);
    expect(amountMatches(exp, { amountCents: 8000, currency: null })).toBe(false);
    expect(amountMatches(exp, {})).toBe(false);
  });
});

describe("Idempotentes Verbuchen", () => {
  it("bereits bezahlt → nichts tun, auch bei abweichendem Betrag", () => {
    expect(settlementDecision({ status: "PAID", amountCents: 8000, currency: "CHF" }, { amountCents: 8000, currency: "CHF" })).toBe("ALREADY_PAID");
    expect(settlementDecision({ status: "PAID", amountCents: 8000, currency: "CHF" }, { amountCents: 1, currency: "EUR" })).toBe("ALREADY_PAID");
  });
  it("offen oder fehlgeschlagen → verbuchen, wenn der Betrag passt", () => {
    expect(settlementDecision({ status: "PENDING", amountCents: 8000, currency: "CHF" }, { amountCents: 8000, currency: "CHF" })).toBe("MARK_PAID");
    expect(settlementDecision({ status: "FAILED", amountCents: 8000, currency: "CHF" }, { amountCents: 8000, currency: "CHF" })).toBe("MARK_PAID");
    expect(settlementDecision({ status: "PENDING", amountCents: 8000, currency: "CHF" }, { amountCents: 800, currency: "CHF" })).toBe("MISMATCH");
  });
  it("Rechnung: offen → bezahlt, sonst nur Hinweis", () => {
    expect(feeInvoiceSettlement({ status: "OPEN" }, "Payrexx")).toEqual({ action: "MARK_PAID" });
    const dup = feeInvoiceSettlement({ status: "PAID" }, "Payrexx");
    expect(dup.action).toBe("NOTE_ONLY");
    expect(dup.action === "NOTE_ONLY" && dup.note).toMatch(/Doppelt/);
    expect(feeInvoiceSettlement({ status: "CANCELLED" }, "Payrexx").action).toBe("NOTE_ONLY");
    expect(onlinePaymentNote("Payrexx")).toBe("Online (Payrexx)");
  });
});

describe("canPayFeeInvoiceOnline", () => {
  const inv = { status: "OPEN", amountCents: 8000, currency: "CHF" };
  it("nur offene Rechnungen mit Betrag und eingerichtetem Anbieter", () => {
    expect(canPayFeeInvoiceOnline(inv, "PAYREXX")).toBe(true);
    expect(canPayFeeInvoiceOnline(inv, "NONE")).toBe(false);
    expect(canPayFeeInvoiceOnline(inv, null)).toBe(false);
    expect(canPayFeeInvoiceOnline({ ...inv, status: "PAID" }, "PAYREXX")).toBe(false);
    expect(canPayFeeInvoiceOnline({ ...inv, amountCents: 0 }, "PAYREXX")).toBe(false);
    expect(canPayFeeInvoiceOnline({ ...inv, currency: "USD" }, "PAYREXX")).toBe(false);
  });
});

describe("Prüfhinweis an der Zahlung", () => {
  it("liest den Hinweis aus detailsJson und ignoriert reine Anbieterdaten", () => {
    const json = paymentDetailsJson({ id: 7 }, { kind: "REFUND", note: "Doppelt bezahlt" });
    expect(paymentReviewFromDetails(json)).toEqual({ kind: "REFUND", note: "Doppelt bezahlt" });
    expect(paymentReviewFromDetails(paymentDetailsJson({ id: 7 }))).toBeNull();
    expect(paymentReviewFromDetails("kein json")).toBeNull();
    expect(paymentReviewFromDetails(null)).toBeNull();
  });

  it("zeigt «Rückerstattung prüfen» nur bei bezahlten, «Betrag weicht ab» nur bei offenen Zahlungen", () => {
    const refund = paymentDetailsJson(null, { kind: "REFUND", note: "x" });
    const mismatch = paymentDetailsJson(null, { kind: "AMOUNT_MISMATCH", note: "y" });
    expect(paymentReviewBadge({ status: "PAID", detailsJson: refund })?.label).toBe("Rückerstattung prüfen");
    expect(paymentReviewBadge({ status: "PENDING", detailsJson: mismatch })?.label).toBe("Betrag weicht ab");
    expect(paymentReviewBadge({ status: "PAID", detailsJson: mismatch })).toBeNull();
    expect(paymentReviewBadge({ status: "FAILED", detailsJson: refund })).toBeNull();
  });
});
