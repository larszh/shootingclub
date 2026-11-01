import "server-only";
import { db } from "@/lib/db";
import { addDays, formatDateZurich, zurichToUtc } from "@/lib/time";
import { feeInvoiceTitle, isStandaloneFeeInvoice } from "@/modules/billing/fee-title";
import { buildJournal, feeInvoiceKind, isPaidOnline, journalTotals, ONLINE_SETTLE_WINDOW_MS, summarizeAccounts, type JournalDocument, type OnlinePayment } from "./journal";
import { ACCOUNT_LABEL, toAccountPlan, type AccountPlan } from "./types";
import { eventKey, loadAccountingEventDates } from "./events";

/**
 * Lädt die Belege eines Vereins für den Buchhaltungsexport und normalisiert sie für buildJournal.
 * Bewusst unabhängig davon, ob die Module heute aktiv sind: Rechnungen aus einem später
 * ausgeschalteten Modul gehören trotzdem in die Buchhaltung.
 */

export async function getAccountPlan(tenantId: string): Promise<AccountPlan> {
  const row = await db.accountingSettings.findUnique({ where: { tenantId } });
  return toAccountPlan(row);
}

/** UTC-Grenzen eines Zeitraums aus Schweizer Kalendertagen: [start, end). */
export function periodBounds(from: string, to: string) {
  return { start: zurichToUtc(from, "00:00"), end: zurichToUtc(addDays(to, 1), "00:00") };
}

const PAYMENT_DONE = ["PAID", "REFUNDED"];

type PaymentRow = { id: string; provider: string; status: string; amountCents: number; currency: string; createdAt: Date; updatedAt: Date };

/**
 * Online-Zahlung normalisieren. Zahlungsdatum: Verbuchung (letzte Änderung, PAID wird danach nicht mehr
 * geändert) bzw. Erstellung bei REFUNDED. Erstattet: letzte Änderung der Zahlung (REFUNDED) oder das
 * Erstattungsdatum der Reservation (`refundedAt`), denn erstattet wird heute auf der Reservation.
 */
function toOnlinePayment(p: PaymentRow, refundedAt: Date | null = null): OnlinePayment {
  const refunded = p.status === "REFUNDED";
  return {
    id: p.id,
    provider: p.provider,
    amountCents: p.amountCents,
    currency: p.currency,
    paidAt: refunded ? p.createdAt : p.updatedAt,
    refundedAt: refunded ? p.updatedAt : refundedAt,
  };
}

/** Hat eine dieser Zahlungen die Rechnung bezahlt gesetzt? (siehe isPaidOnline) */
function paidByOnline(invoicePaidAt: Date | null, payments: PaymentRow[]) {
  if (!invoicePaidAt) return false;
  const t = invoicePaidAt.getTime();
  return payments.some((p) =>
    p.status === "PAID"
      ? isPaidOnline(invoicePaidAt, [p.updatedAt])
      : t >= p.createdAt.getTime() - ONLINE_SETTLE_WINDOW_MS && t <= p.updatedAt.getTime() + ONLINE_SETTLE_WINDOW_MS,
  );
}

type EventDates = Map<string, Date>;

/**
 * Erstattungsdatum einer Reservation (paymentStatus REFUNDED). Es gibt keine eigene Spalte: Datum aus dem
 * protokollierten Statuswechsel (siehe events.ts), nur ohne Eintrag (ältere Daten) die letzte Änderung.
 */
function bookingRefundedAt(b: { id: string; paymentStatus: string; updatedAt: Date }, events: EventDates) {
  return b.paymentStatus === "REFUNDED" ? (events.get(eventKey("refund", "Booking", b.id)) ?? b.updatedAt) : null;
}

function invoiceStatus(s: string): "OPEN" | "PAID" | "CANCELLED" {
  return s === "PAID" ? "PAID" : s === "CANCELLED" ? "CANCELLED" : "OPEN";
}

const paymentSelect = { id: true, provider: true, status: true, amountCents: true, currency: true, createdAt: true, updatedAt: true } as const;

export async function loadJournalDocuments(tenantId: string, from: string, to: string): Promise<JournalDocument[]> {
  const { start, end } = periodBounds(from, to);
  const touched = { gte: start };

  const [fees, bookingInvoices, onlineBookingPayments, ammo, cashBookings] = await Promise.all([
    db.feeInvoice.findMany({
      where: {
        tenantId,
        issuedAt: { lt: end },
        OR: [{ issuedAt: touched }, { paidAt: touched }, { updatedAt: touched }, { payments: { some: { updatedAt: touched } } }],
      },
      select: {
        id: true, number: true, year: true, categoryName: true, amountCents: true, currency: true, status: true, issuedAt: true, paidAt: true, updatedAt: true,
        runId: true, membershipId: true, run: { select: { title: true } },
        payments: { where: { status: { in: PAYMENT_DONE } }, select: paymentSelect, orderBy: { createdAt: "asc" } },
      },
    }),
    db.invoice.findMany({
      where: {
        tenantId,
        issuedAt: { lt: end },
        OR: [{ issuedAt: touched }, { paidAt: touched }, { booking: { updatedAt: touched } }, { booking: { payments: { some: { updatedAt: touched } } } }],
      },
      select: {
        id: true, number: true, amountCents: true, currency: true, status: true, issuedAt: true, paidAt: true,
        booking: {
          select: {
            id: true, startsAt: true, cancelledAt: true, updatedAt: true, paymentStatus: true, resource: { select: { name: true } },
            payments: { where: { status: { in: PAYMENT_DONE } }, select: paymentSelect, orderBy: { createdAt: "asc" } },
          },
        },
      },
    }),
    db.payment.findMany({
      where: {
        status: { in: PAYMENT_DONE },
        booking: { tenantId, invoice: { is: null } },
        createdAt: { lt: end },
        OR: [{ updatedAt: touched }, { booking: { updatedAt: touched } }],
      },
      select: { ...paymentSelect, booking: { select: { id: true, startsAt: true, paymentStatus: true, updatedAt: true, resource: { select: { name: true } } } } },
    }),
    db.ammoOrder.findMany({
      where: {
        tenantId,
        invoiceNumber: { not: null },
        invoiceIssuedAt: { lt: end },
        OR: [{ invoiceIssuedAt: touched }, { paidAt: touched }, { updatedAt: touched }],
      },
      select: { id: true, invoiceNumber: true, invoiceIssuedAt: true, totalCents: true, currency: true, status: true, paymentStatus: true, paidAt: true, updatedAt: true },
    }),
    // Reservationen «Bar / vor Ort»: gelten beim Erfassen als bezahlt, ohne Rechnung und ohne Online-Zahlung.
    db.booking.findMany({
      where: {
        tenantId,
        paymentMethod: "CASH",
        paymentStatus: { in: PAYMENT_DONE },
        totalCents: { gt: 0 },
        invoice: { is: null },
        createdAt: { lt: end },
        OR: [{ paidAt: touched }, { updatedAt: touched }],
      },
      select: { id: true, startsAt: true, paidAt: true, createdAt: true, updatedAt: true, totalCents: true, currency: true, paymentStatus: true, resource: { select: { name: true } } },
    }),
  ]);

  // Storno- und Erstattungsdaten aus dem Protokoll statt aus updatedAt (siehe events.ts).
  const refundedBookingIds = [
    ...bookingInvoices.filter((i) => i.booking.paymentStatus === "REFUNDED").map((i) => i.booking.id),
    ...onlineBookingPayments.flatMap((p) => (p.booking?.paymentStatus === "REFUNDED" ? [p.booking.id] : [])),
    ...cashBookings.filter((b) => b.paymentStatus === "REFUNDED").map((b) => b.id),
  ];
  const events = await loadAccountingEventDates(tenantId, [
    { entity: "FeeInvoice", ids: fees.filter((f) => f.status === "CANCELLED").map((f) => f.id) },
    { entity: "AmmoOrder", ids: ammo.filter((o) => o.paymentStatus === "CANCELLED" || o.status === "CANCELLED").map((o) => o.id) },
    { entity: "Booking", ids: [...new Set(refundedBookingIds)] },
  ]);

  // Rechnungen der Schützenstube: Beitragsrechnungen, mit denen Konsumationen verrechnet wurden.
  const kioskIds = new Set<string>();
  if (fees.length) {
    const billed = await db.kioskEntry.findMany({
      where: { tenantId, billedInvoiceId: { in: fees.map((f) => f.id) } },
      select: { billedInvoiceId: true },
      distinct: ["billedInvoiceId"],
    });
    for (const b of billed) if (b.billedInvoiceId) kioskIds.add(b.billedInvoiceId);
  }

  const docs: JournalDocument[] = [];
  const shortDate = (d: Date) => formatDateZurich(d, { weekday: undefined });

  for (const f of fees) {
    const kind = feeInvoiceKind(f.categoryName, kioskIds.has(f.id));
    const title = feeInvoiceTitle(f, `Mitgliederbeitrag ${f.year}`);
    // Jahreslauf: Titel + Kategorie (z.B. «Mitgliederbeitrag 2026 Aktiv»); Einzelrechnung: ihre Bezeichnung.
    const label = isStandaloneFeeInvoice(f) || kind !== "fee" ? title : `${title} ${f.categoryName}`;
    docs.push({
      type: "invoice", source: "FEE", id: f.id, number: f.number, kind, label,
      amountCents: f.amountCents, currency: f.currency, issuedAt: f.issuedAt, status: invoiceStatus(f.status),
      paidAt: f.paidAt, paidOnline: paidByOnline(f.paidAt, f.payments), refundedAt: null,
      cancelledAt: f.status === "CANCELLED" ? (events.get(eventKey("cancel", "FeeInvoice", f.id)) ?? f.updatedAt) : null,
      onlinePayments: f.payments.map((p) => toOnlinePayment(p)),
    });
  }

  for (const i of bookingInvoices) {
    const refundedAt = bookingRefundedAt(i.booking, events);
    const onlinePaid = i.booking.payments.some((p) => p.status === "PAID");
    docs.push({
      type: "invoice", source: "BOOKING", id: i.id, number: i.number, kind: "booking",
      label: `Reservation ${i.booking.resource.name} ${shortDate(i.booking.startsAt)}`,
      amountCents: i.amountCents, currency: i.currency, issuedAt: i.issuedAt, status: invoiceStatus(i.status),
      paidAt: i.paidAt, paidOnline: paidByOnline(i.paidAt, i.booking.payments),
      // Erstattung gilt für die Online-Zahlungen; ohne solche für die per Bank bezahlte Rechnung.
      refundedAt: onlinePaid ? null : refundedAt,
      cancelledAt: i.status === "CANCELLED" ? (i.booking.cancelledAt ?? i.booking.updatedAt) : null,
      onlinePayments: i.booking.payments.map((p) => toOnlinePayment(p, refundedAt)),
    });
  }

  for (const p of onlineBookingPayments) {
    if (!p.booking) continue;
    docs.push({
      type: "payment", source: "ONLINE", id: p.id, number: `ONL-${p.id.slice(-8).toUpperCase()}`, kind: "booking",
      label: `Reservation ${p.booking.resource.name} ${shortDate(p.booking.startsAt)}`,
      payment: toOnlinePayment(p, bookingRefundedAt(p.booking, events)),
    });
  }

  for (const b of cashBookings) {
    docs.push({
      type: "payment", source: "CASH", id: b.id, number: `BAR-${b.id.slice(-8).toUpperCase()}`, kind: "booking",
      label: `Reservation ${b.resource.name} ${shortDate(b.startsAt)}`,
      payment: { id: b.id, provider: "CASH", amountCents: b.totalCents, currency: b.currency, paidAt: b.paidAt ?? b.createdAt, refundedAt: bookingRefundedAt(b, events) },
    });
  }

  for (const o of ammo) {
    if (!o.invoiceNumber || !o.invoiceIssuedAt) continue;
    const cancelled = o.paymentStatus === "CANCELLED" || o.status === "CANCELLED";
    docs.push({
      type: "invoice", source: "AMMO", id: o.id, number: o.invoiceNumber, kind: "ammo", label: "Munition",
      amountCents: o.totalCents, currency: o.currency, issuedAt: o.invoiceIssuedAt,
      status: cancelled ? "CANCELLED" : o.paymentStatus === "PAID" ? "PAID" : "OPEN",
      paidAt: o.paidAt, paidOnline: false, refundedAt: null,
      cancelledAt: cancelled ? (events.get(eventKey("cancel", "AmmoOrder", o.id)) ?? o.updatedAt) : null,
      // Munition ist nie online bezahlbar (Anbieter-AGB), nur per Rechnung.
      onlinePayments: [],
    });
  }

  return docs;
}

/** Journal, Kontensaldi und Kontrollsumme eines Zeitraums. */
export async function getAccountingJournal(tenantId: string, from: string, to: string) {
  const [accounts, docs] = await Promise.all([getAccountPlan(tenantId), loadJournalDocuments(tenantId, from, to)]);
  const entries = buildJournal(docs, accounts, { from, to });
  return { accounts, entries, summary: summarizeAccounts(entries, accounts, ACCOUNT_LABEL), totals: journalTotals(entries) };
}
