/**
 * Posten von Partnervereinen für «Zahlungen» (gemeinsame Anlagen): Buchungen eines Mitglieds über den
 * eigenen Verein (viaTenantId) auf der Anlage eines anderen Vereins. Rechnungssteller ist der Verein,
 * dem die Anlage gehört. Rein (ohne DB), testbar; geladen in overview.ts (listMyPayments).
 */
import { formatDateZurich } from "@/lib/time";
import { providerLabel as paymentProviderLabel } from "@/lib/payments/catalog";
import { isOverdue } from "./dates";
import type { BillingProfileView } from "./profile";
import type { PaymentItem } from "./overview";

/** Zahlungsangaben eines Vereins (gleiche Form wie PayeeInfo der Zahlungskarten). */
export type PaymentPayee = { iban: string | null; payeeName: string; qrIban: boolean };

export function toPaymentPayee(profile: BillingProfileView, tenantName: string): PaymentPayee {
  return { iban: profile.iban, payeeName: profile.payeeName ?? tenantName, qrIban: profile.qrIban };
}

export function normalizeInvoiceStatus(s: string): PaymentItem["status"] {
  return s === "PAID" ? "PAID" : s === "CANCELLED" ? "CANCELLED" : "OPEN";
}

/**
 * Status einer Reservations-Rechnung für Mitglieder: Eine bezahlte Rechnung bleibt bei der Rückerstattung
 * PAID (nur die Reservation wird REFUNDED), gilt aber als «Erstattet» und zählt nicht mehr als bezahlt.
 */
export function bookingInvoiceStatus(invoiceStatus: string, bookingPaymentStatus?: string | null): PaymentItem["status"] {
  const status = normalizeInvoiceStatus(invoiceStatus);
  return status === "PAID" && bookingPaymentStatus === "REFUNDED" ? "REFUNDED" : status;
}

function groupOf(status: PaymentItem["status"]): PaymentItem["group"] {
  return status === "OPEN" ? "open" : status === "PAID" ? "paid" : "other";
}

function providerLabel(p: string) {
  return p === "WORLDLINE" ? "Worldline" : paymentProviderLabel(p);
}

/**
 * Rechnungen eines Partnervereins an ein Mitglied des aktiven Vereins: Buchung über den aktiven
 * Verein (viaTenantId) auf einer Anlage, die einem anderen Verein gehört (Rechnungssteller).
 */
export function partnerInvoiceWhere(activeTenantId: string, userId: string, extra: { status?: string } = {}) {
  return { tenantId: { not: activeTenantId }, ...extra, booking: { userId, viaTenantId: activeTenantId } };
}

type PartnerInvoiceRow = {
  id: string; tenantId: string; number: string; amountCents: number; currency: string; status: string; issuedAt: Date; dueAt: Date; paidAt: Date | null;
  bookingId: string; booking: { startsAt: Date; paymentStatus?: string | null; resource: { name: string } };
};

/** Posten einer Partner-Rechnung (rein, testbar). `reference` nur mit QR-IBAN des Eigentümers. */
export function partnerInvoiceItem(i: PartnerInvoiceRow, issuer: { tenantId: string; name: string }, payee: PaymentPayee, reference: string | null, now: Date): PaymentItem {
  const status = bookingInvoiceStatus(i.status, i.booking.paymentStatus);
  return {
    key: `BOOKING:${i.id}`, source: "BOOKING", id: i.id, number: i.number,
    title: `Reservation ${i.booking.resource.name}`, detail: `Termin ${formatDateZurich(i.booking.startsAt, { weekday: undefined })} · ${issuer.name}`, memberName: null,
    amountCents: i.amountCents, currency: i.currency, status, group: groupOf(status),
    issuedAt: i.issuedAt, dueAt: i.dueAt, paidAt: i.paidAt,
    overdue: status === "OPEN" && isOverdue(i.dueAt, now), reference: payee.qrIban ? reference : null,
    href: `/bookings/${i.bookingId}/invoice`, external: true,
    issuer, payee,
  };
}

type PartnerPaymentRow = {
  id: string; provider: string; status: string; amountCents: number; currency: string; createdAt: Date; updatedAt: Date; bookingId: string | null;
  booking: { tenantId: string; paidAt: Date | null; startsAt: Date; resource: { name: string } } | null;
};

/** Online-Zahlung einer Partner-Buchung ohne Rechnung (rein, testbar). */
export function partnerPaymentItem(p: PartnerPaymentRow, issuer: { tenantId: string; name: string }): PaymentItem | null {
  if (!p.booking || !p.bookingId) return null;
  const status: PaymentItem["status"] = p.status === "REFUNDED" ? "REFUNDED" : "PAID";
  return {
    key: `ONLINE:${p.id}`, source: "ONLINE", id: p.id, number: "Online",
    title: `Reservation ${p.booking.resource.name}`, detail: `Termin ${formatDateZurich(p.booking.startsAt, { weekday: undefined })} · ${providerLabel(p.provider)} · ${issuer.name}`, memberName: null,
    amountCents: p.amountCents, currency: p.currency, status, group: groupOf(status),
    issuedAt: p.createdAt, dueAt: null, paidAt: status === "PAID" ? p.booking.paidAt ?? p.updatedAt : null,
    overdue: false, reference: null,
    href: `/bookings/${p.bookingId}`, external: false,
    issuer,
  };
}
