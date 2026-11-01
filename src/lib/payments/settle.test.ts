import { beforeEach, describe, expect, it, vi } from "vitest";

/** In-Memory-Ersatz für die DB: eine Zahlung und eine Beitragsrechnung. */
const state = vi.hoisted(() => ({
  payment: null as null | Record<string, unknown>,
  invoice: null as null | Record<string, unknown>,
  notifications: 0,
  audits: [] as string[],
}));

vi.mock("@/lib/db", () => {
  const payment = {
    findUnique: async () => (state.payment ? { ...state.payment, booking: null, feeInvoice: state.invoice ? { ...state.invoice } : null } : null),
    updateMany: async ({ where, data }: { where: { status: { not?: string } | string }; data: Record<string, unknown> }) => {
      if (!state.payment) return { count: 0 };
      const notStatus = typeof where.status === "object" ? where.status.not : undefined;
      if (notStatus && state.payment.status === notStatus) return { count: 0 };
      if (typeof where.status === "string" && state.payment.status !== where.status) return { count: 0 };
      Object.assign(state.payment, data);
      return { count: 1 };
    },
    update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(state.payment!, data),
  };
  const feeInvoice = {
    findUnique: async () => (state.invoice ? { status: state.invoice.status, paymentNote: state.invoice.paymentNote } : null),
    updateMany: async ({ where, data }: { where: { status: string }; data: Record<string, unknown> }) => {
      if (!state.invoice || state.invoice.status !== where.status) return { count: 0 };
      Object.assign(state.invoice, data);
      return { count: 1 };
    },
    update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(state.invoice!, data),
  };
  // SELECT … FOR UPDATE auf die Rechnung (sperrendes Lesen in settlePayment).
  const $queryRaw = async () => (state.invoice ? [{ status: state.invoice.status, paymentNote: state.invoice.paymentNote }] : []);
  const tx = { payment, feeInvoice, $queryRaw, booking: { update: async () => ({}), updateMany: async () => ({ count: 0 }) } };
  return { db: { ...tx, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } };
});
vi.mock("@/lib/audit", () => ({ audit: async (e: { action: string }) => void state.audits.push(e.action) }));
vi.mock("@/lib/notify", () => ({ notify: async () => void state.notifications++ }));
vi.mock("@/lib/crypto", () => ({ decryptJson: () => ({}), encryptJson: () => "" }));

import { beginCheckout, settlePayment } from "./settle";
import { paymentReviewFromDetails } from "./logic";
import type { PaymentProvider } from "./types";

const checkoutInput = { tenantId: "t1", amountCents: 5000, currency: "CHF", reference: "X", description: "d", successUrl: "https://a/ok", cancelUrl: "https://a/c" };

describe("beginCheckout", () => {
  it("lehnt Munition ab, ohne den Anbieter aufzurufen", async () => {
    const createCheckout = vi.fn();
    const provider = { key: "PAYREXX", createCheckout, fetchStatus: vi.fn() } as unknown as PaymentProvider;
    await expect(beginCheckout(provider, { kind: "AMMO", ammoOrderId: "a1" } as never, checkoutInput)).rejects.toThrow(/Munition/);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("legt für Beitragsrechnungen eine Zahlung mit feeInvoiceId und tenantId an", async () => {
    const provider = { key: "PAYREXX", createCheckout: async () => ({ providerRef: "42", redirectUrl: "https://pay" }), fetchStatus: vi.fn() } as unknown as PaymentProvider;
    const r = await beginCheckout(provider, { kind: "FEE_INVOICE", feeInvoiceId: "f1" }, checkoutInput);
    expect(r.redirectUrl).toBe("https://pay");
    expect(r.paymentData).toMatchObject({ feeInvoiceId: "f1", bookingId: null, tenantId: "t1", provider: "PAYREXX", providerRef: "42", amountCents: 5000, currency: "CHF", status: "PENDING" });
  });
});

describe("settlePayment (Beitragsrechnung)", () => {
  beforeEach(() => {
    state.payment = { id: "p1", tenantId: "t1", provider: "PAYREXX", status: "PENDING", amountCents: 8000, currency: "CHF", bookingId: null, feeInvoiceId: "f1" };
    state.invoice = { id: "f1", tenantId: "t1", userId: "u1", number: "MB-1", status: "OPEN", paymentNote: null, amountCents: 8000, currency: "CHF", categoryName: "Aktiv", runId: "r1", membershipId: "m1", year: 2026, run: { title: "Jahresbeitrag 2026" } };
    state.notifications = 0;
    state.audits = [];
  });

  it("markiert die Rechnung genau einmal als bezahlt (Webhook + Rücksprung)", async () => {
    expect(await settlePayment("p1", { amountCents: 8000, currency: "CHF" })).toBe("PAID");
    expect(state.invoice).toMatchObject({ status: "PAID", paymentNote: "Online (Payrexx)" });
    expect(state.invoice!.paidAt).toBeInstanceOf(Date);
    expect(await settlePayment("p1", { amountCents: 8000, currency: "CHF" })).toBe("ALREADY_PAID");
    await new Promise((r) => setTimeout(r, 0));
    expect(state.notifications).toBe(1);
    expect(state.audits.filter((a) => a === "billing.invoice.paid_online")).toHaveLength(1);
  });

  it("verbucht nicht bei falschem Betrag oder falscher Währung", async () => {
    expect(await settlePayment("p1", { amountCents: 100, currency: "CHF" })).toBe("MISMATCH");
    expect(await settlePayment("p1", { amountCents: 8000, currency: "EUR" })).toBe("MISMATCH");
    expect(await settlePayment("p1", { amountCents: null, currency: null })).toBe("MISMATCH");
    expect(state.payment!.status).toBe("PENDING");
    expect(state.invoice!.status).toBe("OPEN");
  });

  it("bereits per Bank bezahlte Rechnung erhält nur einen Hinweis", async () => {
    state.invoice!.status = "PAID";
    expect(await settlePayment("p1", { amountCents: 8000, currency: "CHF" })).toBe("PAID");
    expect(String(state.invoice!.paymentNote)).toMatch(/Doppelt bezahlt/);
    expect(state.notifications).toBe(0);
    expect(state.audits).toEqual(["billing.invoice.online_payment_extra"]);
    expect(paymentReviewFromDetails(state.payment!.detailsJson as string)?.kind).toBe("REFUND");
  });

  it("stornierte Rechnung bleibt storniert und die Zahlung wird zur Rückerstattung markiert", async () => {
    state.invoice!.status = "CANCELLED";
    expect(await settlePayment("p1", { amountCents: 8000, currency: "CHF" })).toBe("PAID");
    expect(state.invoice!.status).toBe("CANCELLED");
    expect(String(state.invoice!.paymentNote)).toMatch(/nach Storno bezahlt – Rückerstattung prüfen/);
    expect(paymentReviewFromDetails(state.payment!.detailsJson as string)).toMatchObject({ kind: "REFUND" });
  });

  it("protokolliert eine Betragsabweichung nur einmal, auch bei wiederholter Abfrage", async () => {
    for (let i = 0; i < 3; i++) expect(await settlePayment("p1", { amountCents: 4900, currency: "CHF" })).toBe("MISMATCH");
    expect(state.audits.filter((a) => a === "payment.amount_mismatch")).toHaveLength(1);
    expect(paymentReviewFromDetails(state.payment!.detailsJson as string)?.kind).toBe("AMOUNT_MISMATCH");
    // Andere Abweichung → neuer Eintrag
    expect(await settlePayment("p1", { amountCents: 5000, currency: "EUR" })).toBe("MISMATCH");
    expect(state.audits.filter((a) => a === "payment.amount_mismatch")).toHaveLength(2);
    expect(state.payment!.status).toBe("PENDING");
  });
});
