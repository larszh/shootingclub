import "server-only";
import { db } from "@/lib/db";
import { addDays, formatDateZurich, zurichToUtc } from "@/lib/time";
import { feeInvoiceTitle, isStandaloneFeeInvoice } from "@/modules/billing/fee-title";
import { buildJournal, feeInvoiceKind, journalTotals, summarizeAccounts, type JournalDocument, type OnlinePayment } from "./journal";
import { ACCOUNT_LABEL, toAccountPlan, type AccountPlan } from "./types";

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
 * Online-Zahlung normalisieren. Zahlungsdatum: Bezahlt-Datum des Belegs (falls bekannt), sonst
 * letzte Änderung (PAID) bzw. Erstellung (REFUNDED). Erstattet: letzte Änderung der Zahlung.
 */
function toOnlinePayment(p: PaymentRow, docPaidAt: Date | null): OnlinePayment {
  const refunded = p.status === "REFUNDED";
  return {
    id: p.id,
    provider: p.provider,
    amountCents: p.amountCents,
    currency: p.currency,
    paidAt: docPaidAt ?? (refunded ? p.createdAt : p.updatedAt),
    refundedAt: refunded ? p.updatedAt : null,
  };
}

function invoiceStatus(s: string): "OPEN" | "PAID" | "CANCELLED" {
  return s === "PAID" ? "PAID" : s === "CANCELLED" ? "CANCELLED" : "OPEN";
}

const paymentSelect = { id: true, provider: true, status: true, amountCents: true, currency: true, createdAt: true, updatedAt: true } as const;

export async function loadJournalDocuments(tenantId: string, from: string, to: string): Promise<JournalDocument[]> {
  const { start, end } = periodBounds(from, to);
  const touched = { gte: start };

  const [fees, bookingInvoices, onlineBookingPayments, ammo] = await Promise.all([
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
            startsAt: true, cancelledAt: true, updatedAt: true, resource: { select: { name: true } },
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
        OR: [{ updatedAt: touched }, { booking: { paidAt: touched } }],
      },
      select: { ...paymentSelect, booking: { select: { id: true, startsAt: true, paidAt: true, resource: { select: { name: true } } } } },
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
      paidAt: f.paidAt, cancelledAt: f.status === "CANCELLED" ? f.updatedAt : null,
      onlinePayments: f.payments.map((p) => toOnlinePayment(p, p.status === "PAID" ? f.paidAt : null)),
    });
  }

  for (const i of bookingInvoices) {
    docs.push({
      type: "invoice", source: "BOOKING", id: i.id, number: i.number, kind: "booking",
      label: `Reservation ${i.booking.resource.name} ${shortDate(i.booking.startsAt)}`,
      amountCents: i.amountCents, currency: i.currency, issuedAt: i.issuedAt, status: invoiceStatus(i.status),
      paidAt: i.paidAt, cancelledAt: i.status === "CANCELLED" ? (i.booking.cancelledAt ?? i.booking.updatedAt) : null,
      onlinePayments: i.booking.payments.map((p) => toOnlinePayment(p, p.status === "PAID" ? i.paidAt : null)),
    });
  }

  for (const p of onlineBookingPayments) {
    if (!p.booking) continue;
    docs.push({
      type: "payment", source: "ONLINE", id: p.id, number: `ONL-${p.id.slice(-8).toUpperCase()}`, kind: "booking",
      label: `Reservation ${p.booking.resource.name} ${shortDate(p.booking.startsAt)}`,
      payment: toOnlinePayment(p, p.status === "PAID" ? p.booking.paidAt : null),
    });
  }

  for (const o of ammo) {
    if (!o.invoiceNumber || !o.invoiceIssuedAt) continue;
    const cancelled = o.paymentStatus === "CANCELLED" || o.status === "CANCELLED";
    docs.push({
      type: "invoice", source: "AMMO", id: o.id, number: o.invoiceNumber, kind: "ammo", label: "Munition",
      amountCents: o.totalCents, currency: o.currency, issuedAt: o.invoiceIssuedAt,
      status: cancelled ? "CANCELLED" : o.paymentStatus === "PAID" ? "PAID" : "OPEN",
      paidAt: o.paidAt, cancelledAt: cancelled ? o.updatedAt : null,
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
