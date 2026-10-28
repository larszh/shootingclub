import "server-only";
import { db } from "@/lib/db";
import { getActiveProvider, PaymentError } from "./payments";
import { formatDateTimeZurich } from "@/lib/time";

type BookingLike = { id: string; tenantId: string; totalCents: number; currency: string; startsAt: Date; resourceId: string };

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function startOnlinePayment(b: BookingLike, customerEmail?: string): Promise<{ ok: true; redirectUrl: string } | { ok: false; error: string }> {
  const settings = await db.bookingSettings.findUnique({ where: { tenantId: b.tenantId } });
  const provider = await getActiveProvider(b.tenantId, settings?.onlineProvider ?? "NONE");
  if (!provider) return { ok: false, error: "Online-Zahlung ist für diesen Verein nicht eingerichtet." };
  const resource = await db.resource.findUnique({ where: { id: b.resourceId }, select: { name: true } });
  try {
    const result = await provider.createCheckout({
      bookingId: b.id,
      amountCents: b.totalCents,
      currency: b.currency,
      description: `Reservation ${resource?.name ?? ""} ${formatDateTimeZurich(b.startsAt)}`.trim(),
      successUrl: `${appUrl()}/bookings/${b.id}/return`,
      cancelUrl: `${appUrl()}/bookings/${b.id}?cancelled=1`,
      customerEmail,
    });
    await db.$transaction([
      db.payment.create({ data: { bookingId: b.id, provider: provider.key, providerRef: result.providerRef, status: "PENDING", amountCents: b.totalCents, currency: b.currency } }),
      db.booking.update({ where: { id: b.id }, data: { paymentStatus: "PENDING" } }),
    ]);
    return { ok: true, redirectUrl: result.redirectUrl };
  } catch (e) {
    const msg = e instanceof PaymentError ? e.message : "Zahlungsanbieter nicht erreichbar.";
    console.error("Checkout fehlgeschlagen:", e);
    return { ok: false, error: msg };
  }
}

/** Prüft die letzte Zahlung einer Buchung beim Anbieter und aktualisiert den Status. */
export async function verifyBookingPayment(bookingId: string) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!b) return { status: "UNKNOWN" as const };
  if (b.paymentStatus === "PAID") return { status: "PAID" as const };
  const payment = b.payments[0];
  if (!payment) return { status: b.paymentStatus };
  const provider = await getActiveProvider(b.tenantId, payment.provider);
  if (!provider) return { status: b.paymentStatus };
  try {
    const v = await provider.verify(payment.providerRef);
    if (v.status === "PAID") {
      await markPaymentPaid(payment.id, v.details);
      return { status: "PAID" as const };
    }
    if (v.status === "FAILED") {
      await db.$transaction([
        db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", detailsJson: JSON.stringify(v.details ?? null) } }),
        db.booking.update({ where: { id: b.id }, data: { paymentStatus: "FAILED" } }),
      ]);
      return { status: "FAILED" as const };
    }
    return { status: "PENDING" as const };
  } catch (e) {
    console.error("Zahlungsprüfung fehlgeschlagen:", e);
    return { status: "PENDING" as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function markPaymentPaid(paymentId: string, details?: unknown) {
  const p = await db.payment.findUnique({ where: { id: paymentId }, include: { booking: { select: { status: true, adminNote: true } } } });
  if (!p || p.status === "PAID") return;
  const now = new Date();
  // Zahlung nach (automatischer) Stornierung: Geld ist eingegangen, Platz aber nicht mehr reserviert.
  const lateNote = ["CANCELLED", "REJECTED"].includes(p.booking.status) ? "Zahlung nach Stornierung eingegangen – Rückerstattung prüfen." : null;
  await db.$transaction([
    db.payment.update({ where: { id: paymentId }, data: { status: "PAID", detailsJson: JSON.stringify(details ?? null) } }),
    db.booking.update({
      where: { id: p.bookingId },
      data: { paymentStatus: "PAID", paidAt: now, ...(lateNote ? { adminNote: [p.booking.adminNote, lateNote].filter(Boolean).join(" ").slice(-191) } : {}) },
    }),
  ]);
  if (lateNote) console.warn(`Zahlung ${paymentId} für stornierte Buchung ${p.bookingId} eingegangen.`);
}

/**
 * Markiert eine Zahlung anhand der Anbieter-Referenz als bezahlt – nur innerhalb des Vereins und
 * Anbieters, dessen Webhook-Signatur geprüft wurde, und nur bei passendem Betrag und Währung.
 */
export async function markPaidByProviderRef(
  scope: { tenantId: string; provider: string },
  providerRef: string,
  paid: { amountCents: number | null; currency: string | null },
  details?: unknown,
) {
  const p = await db.payment.findFirst({ where: { providerRef, provider: scope.provider, booking: { tenantId: scope.tenantId } } });
  if (!p) return false;
  if (paid.amountCents !== p.amountCents || (paid.currency ?? "").toUpperCase() !== p.currency.toUpperCase()) {
    console.warn(`Zahlung ${p.id}: Betrag/Währung aus Webhook (${paid.amountCents} ${paid.currency}) passt nicht zu ${p.amountCents} ${p.currency}.`);
    return false;
  }
  await markPaymentPaid(p.id, details);
  return true;
}
