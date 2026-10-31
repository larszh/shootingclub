import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { formatMoney } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";
import { appendPaymentNote } from "@/modules/billing/types";
import { feeInvoiceTitle } from "@/modules/billing/fee-title";
import { getActiveProvider } from "./index";
import { providerLabel } from "./catalog";
import { assertOnlinePayable, feeInvoiceSettlement, onlinePaymentNote, settlementDecision } from "./logic";
import type { CheckoutInput, PaymentProvider, StatusResult } from "./types";

/**
 * Verbuchen von Online-Zahlungen (Reservationen und Beitragsrechnungen).
 * Grundsätze:
 * - Status kommt immer vom Anbieter selbst (API-Abfrage oder signierter Webhook).
 * - Betrag und Währung müssen exakt passen, sonst bleibt die Zahlung offen.
 * - Idempotent: eine Zahlung wird genau einmal als bezahlt verbucht (bedingtes Update).
 */

export type PaymentTarget = { kind: "BOOKING"; bookingId: string } | { kind: "FEE_INVOICE"; feeInvoiceId: string };

/** Checkout beim Anbieter anlegen und die Daten für den Payment-Datensatz liefern. */
export async function beginCheckout(provider: PaymentProvider, target: PaymentTarget, input: CheckoutInput) {
  // Munition und andere Quellen dürfen nie online bezahlt werden.
  assertOnlinePayable(target.kind);
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Ungültiger Betrag für Online-Zahlung");
  const result = await provider.createCheckout(input);
  const paymentData: Prisma.PaymentUncheckedCreateInput = {
    tenantId: input.tenantId,
    bookingId: target.kind === "BOOKING" ? target.bookingId : null,
    feeInvoiceId: target.kind === "FEE_INVOICE" ? target.feeInvoiceId : null,
    provider: provider.key,
    providerRef: result.providerRef.slice(0, 191),
    status: "PENDING",
    amountCents: input.amountCents,
    currency: input.currency.toUpperCase(),
  };
  return { redirectUrl: result.redirectUrl, paymentData };
}

export type SettleOutcome = "PAID" | "ALREADY_PAID" | "MISMATCH" | "NOT_FOUND";

const paymentInclude = {
  booking: { select: { id: true, tenantId: true, status: true, adminNote: true } },
  feeInvoice: { select: { id: true, tenantId: true, userId: true, number: true, status: true, paymentNote: true, amountCents: true, currency: true, categoryName: true, runId: true, membershipId: true, year: true, run: { select: { title: true } } } },
} satisfies Prisma.PaymentInclude;

function paymentTenantId(p: { tenantId: string | null; booking: { tenantId: string } | null; feeInvoice: { tenantId: string } | null }) {
  return p.tenantId ?? p.booking?.tenantId ?? p.feeInvoice?.tenantId ?? null;
}

/**
 * Zahlung als bezahlt verbuchen (Reservation bzw. Beitragsrechnung nachführen).
 * `reported`: Betrag und Währung, die der Anbieter gemeldet hat.
 */
export async function settlePayment(paymentId: string, reported: { amountCents?: number | null; currency?: string | null }, details?: unknown): Promise<SettleOutcome> {
  const p = await db.payment.findUnique({ where: { id: paymentId }, include: paymentInclude });
  if (!p) return "NOT_FOUND";
  const decision = settlementDecision(p, reported);
  if (decision === "ALREADY_PAID") return "ALREADY_PAID";
  const tenantId = paymentTenantId(p);
  if (decision === "MISMATCH") {
    console.warn(`Zahlung ${p.id}: gemeldeter Betrag (${reported.amountCents ?? "?"} ${reported.currency ?? "?"}) passt nicht zu ${p.amountCents} ${p.currency}.`);
    await audit({ tenantId, actorName: `Online-Zahlung (${providerLabel(p.provider)})`, action: "payment.amount_mismatch", entity: "Payment", entityId: p.id, detail: `gemeldet ${reported.amountCents ?? "?"} ${reported.currency ?? "?"}, erwartet ${p.amountCents} ${p.currency}` });
    return "MISMATCH";
  }

  const now = new Date();
  const label = providerLabel(p.provider);
  type FeeEffect = { kind: "paid" | "note"; note?: string } | null;
  const result = await db.$transaction(async (tx) => {
    // Bedingtes Update: nur der erste Aufruf (Webhook oder Rücksprung) verbucht.
    const res = await tx.payment.updateMany({ where: { id: p.id, status: { not: "PAID" } }, data: { status: "PAID", detailsJson: JSON.stringify(details ?? null) } });
    if (res.count === 0) return { settled: false as const, lateBooking: false, fee: null as FeeEffect };

    let lateBooking = false;
    if (p.booking) {
      // Zahlung nach (automatischer) Stornierung: Geld ist eingegangen, Platz aber nicht mehr reserviert.
      lateBooking = ["CANCELLED", "REJECTED"].includes(p.booking.status);
      const lateNote = lateBooking ? "Zahlung nach Stornierung eingegangen – Rückerstattung prüfen." : null;
      await tx.booking.update({
        where: { id: p.booking.id },
        data: { paymentStatus: "PAID", paidAt: now, ...(lateNote ? { adminNote: [p.booking.adminNote, lateNote].filter(Boolean).join(" ").slice(-191) } : {}) },
      });
    }

    let fee: FeeEffect = null;
    if (p.feeInvoice) {
      // Frisch lesen (innerhalb der Transaktion), damit eine parallele Bankbuchung erkannt wird.
      const inv = await tx.feeInvoice.findUnique({ where: { id: p.feeInvoice.id }, select: { status: true, paymentNote: true } });
      if (inv) {
        const s = feeInvoiceSettlement(inv, label);
        if (s.action === "MARK_PAID") {
          const upd = await tx.feeInvoice.updateMany({
            where: { id: p.feeInvoice.id, status: "OPEN" },
            data: { status: "PAID", paidAt: now, paymentNote: appendPaymentNote(inv.paymentNote, onlinePaymentNote(label)) },
          });
          fee = upd.count ? { kind: "paid" } : null;
        } else {
          await tx.feeInvoice.update({ where: { id: p.feeInvoice.id }, data: { paymentNote: appendPaymentNote(inv.paymentNote, s.note) } });
          fee = { kind: "note", note: s.note };
        }
      }
    }
    return { settled: true as const, lateBooking, fee };
  });

  if (!result.settled) return "ALREADY_PAID";
  if (result.lateBooking) console.warn(`Zahlung ${p.id} für stornierte Buchung ${p.booking?.id} eingegangen.`);

  if (p.feeInvoice && result.fee) {
    const inv = p.feeInvoice;
    const amount = formatMoney(p.amountCents, p.currency);
    await audit({
      tenantId,
      actorId: null,
      actorName: `Online-Zahlung (${label})`,
      action: result.fee.kind === "paid" ? "billing.invoice.paid_online" : "billing.invoice.online_payment_extra",
      entity: "FeeInvoice",
      entityId: inv.id,
      detail: result.fee.kind === "paid" ? `${inv.number} ${amount} via ${label}` : `${inv.number} ${amount}: ${result.fee.note ?? ""}`,
    });
    if (result.fee.kind === "paid" && inv.userId) {
      const title = feeInvoiceTitle(inv, `Mitgliederbeitrag ${inv.year}`);
      void notify({
        tenantId: inv.tenantId,
        userIds: [inv.userId],
        topic: "invoices",
        title: "Zahlung erhalten",
        body: `Danke! Die Rechnung ${inv.number} (${title}) über ${amount} ist online bezahlt.`,
        url: "/payments",
        tag: `invoice:${inv.id}`,
        dedupeKey: `fee-paid-online:${inv.id}`,
      }).catch((e) => console.error("Zahlungsbestätigung fehlgeschlagen:", (e as Error).message));
    }
  }
  return "PAID";
}

/** Zahlung anhand der Anbieter-Referenz verbuchen – nur innerhalb von Verein und Anbieter des Webhooks. */
export async function settleByProviderRef(
  scope: { tenantId: string; provider: string },
  providerRef: string,
  reported: { amountCents?: number | null; currency?: string | null },
  details?: unknown,
): Promise<SettleOutcome> {
  const p = await findPaymentByProviderRef(scope, providerRef);
  if (!p) return "NOT_FOUND";
  return settlePayment(p.id, reported, details);
}

export async function findPaymentByProviderRef(scope: { tenantId: string; provider: string }, providerRef: string) {
  return db.payment.findFirst({
    where: {
      providerRef,
      provider: scope.provider,
      OR: [{ tenantId: scope.tenantId }, { booking: { tenantId: scope.tenantId } }, { feeInvoice: { tenantId: scope.tenantId } }],
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Laufende Zahlung als fehlgeschlagen markieren (bezahlte bleiben unangetastet). */
export async function markPaymentFailed(paymentId: string, details?: unknown) {
  const p = await db.payment.findUnique({ where: { id: paymentId }, select: { id: true, bookingId: true } });
  if (!p) return;
  await db.$transaction(async (tx) => {
    const res = await tx.payment.updateMany({ where: { id: p.id, status: "PENDING" }, data: { status: "FAILED", detailsJson: JSON.stringify(details ?? null) } });
    if (res.count && p.bookingId) await tx.booking.updateMany({ where: { id: p.bookingId, paymentStatus: { not: "PAID" } }, data: { paymentStatus: "FAILED" } });
  });
}

export type RefreshResult = { status: "PAID" | "PENDING" | "FAILED"; error?: string };

/** Status einer Zahlung beim Anbieter abfragen und verbuchen (Rücksprungseite). */
export async function refreshPaymentStatus(paymentId: string): Promise<RefreshResult> {
  const p = await db.payment.findUnique({ where: { id: paymentId }, include: paymentInclude });
  if (!p) return { status: "PENDING" };
  if (p.status === "PAID") return { status: "PAID" };
  const tenantId = paymentTenantId(p);
  if (!tenantId) return { status: "PENDING" };
  const provider = await getActiveProvider(tenantId, p.provider);
  if (!provider) return { status: p.status === "FAILED" ? "FAILED" : "PENDING" };
  let v: StatusResult;
  try {
    v = await provider.fetchStatus(p.providerRef);
  } catch (e) {
    console.error("Zahlungsprüfung fehlgeschlagen:", e);
    return { status: "PENDING", error: e instanceof Error ? e.message : String(e) };
  }
  if (v.status === "PAID") {
    const outcome = await settlePayment(p.id, v, v.details);
    if (outcome === "MISMATCH") return { status: "PENDING", error: "Der gemeldete Betrag stimmt nicht mit der Rechnung überein. Der Verein prüft die Zahlung." };
    return { status: "PAID" };
  }
  if (v.status === "FAILED") {
    await markPaymentFailed(p.id, v.details);
    return { status: "FAILED" };
  }
  return { status: "PENDING" };
}
