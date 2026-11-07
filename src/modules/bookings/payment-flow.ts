import "server-only";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/mail";
import { getActiveProvider, PaymentError } from "@/lib/payments";
import { beginCheckout, refreshPaymentStatus, settleByProviderRef, settlePayment } from "@/lib/payments/settle";
import { formatDateTimeZurich } from "@/lib/time";
import { notify } from "@/lib/notify";
import { formatDateTime, formatMoneyLocale, getT } from "@/lib/i18n/core";

type BookingLike = { id: string; tenantId: string; totalCents: number; currency: string; startsAt: Date; resourceId: string };

/** Online-Zahlung starten; Fehlermeldungen in der Sprache `locale` (Standard Deutsch). */
export async function startOnlinePayment(b: BookingLike, customerEmail?: string, locale?: string | null): Promise<{ ok: true; redirectUrl: string } | { ok: false; error: string }> {
  const t = getT(locale);
  const settings = await db.bookingSettings.findUnique({ where: { tenantId: b.tenantId } });
  const provider = await getActiveProvider(b.tenantId, settings?.onlineProvider ?? "NONE");
  if (!provider) return { ok: false, error: t("misc.booking.pay.notConfigured") };
  const resource = await db.resource.findUnique({ where: { id: b.resourceId }, select: { name: true } });
  try {
    const { redirectUrl, paymentData } = await beginCheckout(provider, { kind: "BOOKING", bookingId: b.id }, {
      tenantId: b.tenantId,
      amountCents: b.totalCents,
      currency: b.currency,
      reference: b.id,
      description: `Reservation ${resource?.name ?? ""} ${formatDateTimeZurich(b.startsAt)}`.trim(),
      successUrl: appUrl(`/bookings/${b.id}/return`),
      cancelUrl: appUrl(`/bookings/${b.id}?cancelled=1`),
      customerEmail,
      metadata: { bookingId: b.id },
    });
    await db.$transaction([
      db.payment.create({ data: paymentData }),
      db.booking.update({ where: { id: b.id }, data: { paymentStatus: "PENDING" } }),
    ]);
    return { ok: true, redirectUrl };
  } catch (e) {
    const msg = e instanceof PaymentError ? e.message : t("misc.booking.pay.unreachable");
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
  const r = await refreshPaymentStatus(payment.id);
  return r.error ? { status: r.status, error: r.error, needsReview: r.needsReview ?? false } : { status: r.status };
}

/** Zahlung als bezahlt verbuchen (Betrag und Währung aus der Payment-Zeile, z.B. für Tests/Admin). */
export async function markPaymentPaid(paymentId: string, details?: unknown) {
  const p = await db.payment.findUnique({ where: { id: paymentId }, select: { amountCents: true, currency: true } });
  if (!p) return;
  await settlePayment(paymentId, p, details);
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
  return (await settleByProviderRef(scope, providerRef, paid, details)) === "PAID";
}

/**
 * Bestätigung an das Mitglied, sobald die Online-Zahlung einer Reservation verbucht ist
 * (Aufruf aus settlePayment, nur beim ersten erfolgreichen Verbuchen). Nur für bestätigte,
 * bezahlte Buchungen; Anfragen erhalten ihre Bestätigung mit dem Entscheid der Verwaltung.
 * Idempotent: gleicher dedupeKey → keine zweite E-Mail. Wirft nie.
 */
export async function notifyBookingPaid(bookingId: string): Promise<void> {
  try {
    const b = await db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true, tenantId: true, viaTenantId: true, userId: true, status: true, paymentMethod: true, paymentStatus: true,
        startsAt: true, totalCents: true, currency: true, resource: { select: { name: true } }, tenant: { select: { name: true } },
      },
    });
    if (!b?.userId || b.status !== "CONFIRMED" || b.paymentStatus !== "PAID" || b.paymentMethod !== "ONLINE") return;
    const resource = b.viaTenantId ? `${b.resource.name} (${b.tenant.name})` : b.resource.name;
    const localeVars = (locale: string) => ({ date: formatDateTime(b.startsAt, locale), amount: formatMoneyLocale(b.totalCents, locale, b.currency) });
    const de = getT("de");
    await notify({
      tenantId: b.viaTenantId ?? b.tenantId,
      userIds: [b.userId],
      topic: "bookings",
      title: de("misc.booking.paid.title"),
      body: de("misc.booking.paid.body", { resource, ...localeVars("de") }),
      url: `/bookings/${b.id}`,
      tag: `booking:${b.id}`,
      i18n: { title: "misc.booking.paid.title", body: "misc.booking.paid.body", vars: { resource }, localeVars },
      dedupeKey: `booking-paid:${b.id}`,
    });
  } catch (e) {
    console.error("Zahlungsbestätigung Reservation fehlgeschlagen:", (e as Error).message);
  }
}
