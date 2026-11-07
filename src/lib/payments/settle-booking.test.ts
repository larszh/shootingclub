import { beforeEach, describe, expect, it, vi } from "vitest";

/** settlePayment für Reservationen: Bestätigung an das Mitglied genau einmal, nicht bei Stornierung. */
const state = vi.hoisted(() => ({
  payment: null as null | Record<string, unknown>,
  booking: null as null | Record<string, unknown>,
  paidNotices: [] as string[],
}));

vi.mock("@/lib/db", () => {
  const payment = {
    findUnique: async () => (state.payment ? { ...state.payment, booking: state.booking ? { ...state.booking } : null, feeInvoice: null } : null),
    updateMany: async ({ where, data }: { where: { status: { not?: string } }; data: Record<string, unknown> }) => {
      if (!state.payment || state.payment.status === where.status.not) return { count: 0 };
      Object.assign(state.payment, data);
      return { count: 1 };
    },
    update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(state.payment!, data),
  };
  const booking = { update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(state.booking!, data), updateMany: async () => ({ count: 0 }) };
  const tx = { payment, booking, feeInvoice: {}, $queryRaw: async () => [] };
  return { db: { ...tx, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } };
});
vi.mock("@/lib/audit", () => ({ audit: async () => undefined }));
vi.mock("@/lib/notify", () => ({ notify: async () => undefined }));
vi.mock("@/lib/crypto", () => ({ decryptJson: () => ({}), encryptJson: () => "" }));
vi.mock("@/modules/bookings/payment-flow", () => ({ notifyBookingPaid: async (id: string) => void state.paidNotices.push(id) }));

import { settlePayment } from "./settle";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("settlePayment (Reservation)", () => {
  beforeEach(() => {
    state.payment = { id: "p1", tenantId: "t1", provider: "PAYREXX", status: "PENDING", amountCents: 3000, currency: "CHF", bookingId: "b1", feeInvoiceId: null, detailsJson: null };
    state.booking = { id: "b1", tenantId: "t1", status: "CONFIRMED", adminNote: null };
    state.paidNotices = [];
  });

  it("bestätigt die bezahlte Reservation genau einmal (Webhook + Rücksprung)", async () => {
    expect(await settlePayment("p1", { amountCents: 3000, currency: "CHF" })).toBe("PAID");
    expect(await settlePayment("p1", { amountCents: 3000, currency: "CHF" })).toBe("ALREADY_PAID");
    await flush();
    expect(state.booking).toMatchObject({ paymentStatus: "PAID" });
    expect(state.paidNotices).toEqual(["b1"]);
  });

  it("keine Bestätigung bei Zahlung nach Stornierung oder bei falschem Betrag", async () => {
    expect(await settlePayment("p1", { amountCents: 100, currency: "CHF" })).toBe("MISMATCH");
    state.booking!.status = "CANCELLED";
    expect(await settlePayment("p1", { amountCents: 3000, currency: "CHF" })).toBe("PAID");
    await flush();
    expect(state.paidNotices).toEqual([]);
  });
});
