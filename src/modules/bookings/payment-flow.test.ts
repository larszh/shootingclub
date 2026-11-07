import { beforeEach, describe, expect, it, vi } from "vitest";

/** notifyBookingPaid: Bestätigung nach Online-Zahlung (Sprache pro Empfänger über i18n-Schlüssel). */
const state = vi.hoisted(() => ({
  booking: null as null | Record<string, unknown>,
  sent: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/db", () => ({ db: { booking: { findUnique: async () => state.booking } } }));
vi.mock("@/lib/notify", () => ({ notify: async (n: Record<string, unknown>) => void state.sent.push(n) }));
vi.mock("@/lib/mail", () => ({ appUrl: (p: string) => `https://app.test${p}` }));
vi.mock("@/lib/payments", () => ({ getActiveProvider: async () => null, PaymentError: class extends Error {} }));
vi.mock("@/lib/payments/settle", () => ({ beginCheckout: vi.fn(), refreshPaymentStatus: vi.fn(), settleByProviderRef: vi.fn(), settlePayment: vi.fn() }));

import { notifyBookingPaid } from "./payment-flow";
import { getT } from "@/lib/i18n/core";

const base = {
  id: "b1", tenantId: "owner", viaTenantId: null, userId: "u1", status: "CONFIRMED", paymentMethod: "ONLINE", paymentStatus: "PAID",
  startsAt: new Date("2026-06-01T08:00:00Z"), totalCents: 2500, currency: "CHF", resource: { name: "Bahn 3" }, tenant: { name: "SV Ost" },
};

describe("notifyBookingPaid", () => {
  beforeEach(() => {
    state.booking = { ...base };
    state.sent = [];
  });

  it("sendet eine Bestätigung mit Betrag und festem dedupeKey", async () => {
    await notifyBookingPaid("b1");
    expect(state.sent).toHaveLength(1);
    const n = state.sent[0]! as { tenantId: string; userIds: string[]; dedupeKey: string; title: string; body: string; i18n: { title: string; body: string; vars: Record<string, string>; localeVars: (l: string) => Record<string, string> } };
    expect(n).toMatchObject({ tenantId: "owner", userIds: ["u1"], dedupeKey: "booking-paid:b1", title: "Reservation bezahlt und bestätigt" });
    expect(n.body).toContain("«Bahn 3»");
    expect(n.body).toMatch(/CHF\s25\.00/);
    expect(n.i18n.title).toBe("misc.booking.paid.title");
    const en = getT("en")(n.i18n.body, { ...n.i18n.vars, ...n.i18n.localeVars("en") });
    expect(en).toContain("Your booking “Bahn 3”");
  });

  it("Partnerbuchung läuft über den Partnerverein und nennt den Eigentümer", async () => {
    state.booking = { ...base, viaTenantId: "guest" };
    await notifyBookingPaid("b1");
    expect(state.sent[0]).toMatchObject({ tenantId: "guest" });
    expect(String(state.sent[0]!.body)).toContain("Bahn 3 (SV Ost)");
  });

  it("nichts bei Anfrage, offener Zahlung, Rechnung oder ohne Mitglied", async () => {
    for (const patch of [{ status: "PENDING" }, { paymentStatus: "PENDING" }, { paymentMethod: "INVOICE" }, { userId: null }]) {
      state.booking = { ...base, ...patch };
      await notifyBookingPaid("b1");
    }
    state.booking = null;
    await notifyBookingPaid("b1");
    expect(state.sent).toHaveLength(0);
  });
});
