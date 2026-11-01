import "server-only";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/mail";
import { getActiveProvider, isProviderKey, PaymentError, type PaymentProviderKey } from "@/lib/payments";
import { beginCheckout, refreshPaymentStatus } from "@/lib/payments/settle";
import { canPayFeeInvoiceOnline, feeInvoiceReturnPath, paymentReviewFromDetails, PENDING_STALE_MINUTES } from "@/lib/payments/logic";
import { feeInvoiceTitle } from "./fee-title";

/**
 * Online-Zahlung von Beitragsrechnungen (FeeInvoice: Jahresbeitrag, Ersatzabgabe, Schützenstube …).
 * Munitionsrechnungen (AmmoOrder) sind ausdrücklich ausgeschlossen: sie sind keine FeeInvoice und
 * beginCheckout() lehnt jede andere Art als BOOKING/FEE_INVOICE ab.
 */

/** Anbieter für Beiträge, sofern im Rechnungsprofil gewählt und eingerichtet/aktiviert. */
export async function getOnlineFeeProviderKey(tenantId: string): Promise<PaymentProviderKey | null> {
  const profile = await db.billingProfile.findUnique({ where: { tenantId }, select: { onlineFeeProvider: true } });
  const key = profile?.onlineFeeProvider ?? "NONE";
  if (!isProviderKey(key)) return null;
  const cfg = await db.paymentProviderConfig.findUnique({ where: { tenantId_provider: { tenantId, provider: key } }, select: { enabled: true } });
  return cfg?.enabled ? key : null;
}

type Viewer = { tenantId: string; userId: string; email?: string | null };

async function loadOwnInvoice(viewer: Viewer, invoiceId: string) {
  const inv = await db.feeInvoice.findUnique({ where: { id: invoiceId }, include: { run: { select: { title: true } } } });
  if (!inv || inv.tenantId !== viewer.tenantId || inv.userId !== viewer.userId) return null;
  return inv;
}

export type FeePayStart = { ok: true; redirectUrl: string } | { ok: false; error: string };

/** Checkout für eine eigene, offene Beitragsrechnung starten. */
export async function startFeeInvoicePayment(viewer: Viewer, invoiceId: string): Promise<FeePayStart> {
  const inv = await loadOwnInvoice(viewer, invoiceId);
  if (!inv) return { ok: false, error: "Rechnung nicht gefunden." };
  const providerKey = await getOnlineFeeProviderKey(viewer.tenantId);
  if (!canPayFeeInvoiceOnline(inv, providerKey)) {
    return { ok: false, error: inv.status !== "OPEN" ? "Diese Rechnung ist nicht mehr offen." : "Online-Zahlung ist für diese Rechnung nicht verfügbar." };
  }
  // Doppelzahlung vermeiden: gerade bezahlte, aber noch nicht verbuchte Zahlung zuerst prüfen.
  const recent = await db.payment.findFirst({
    where: { feeInvoiceId: inv.id, status: "PENDING", createdAt: { gte: new Date(Date.now() - PENDING_STALE_MINUTES * 60_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const r = await refreshPaymentStatus(recent.id);
    if (r.status === "PAID") return { ok: false, error: "Diese Rechnung ist bereits bezahlt. Danke!" };
  }
  const provider = await getActiveProvider(viewer.tenantId, providerKey);
  if (!provider) return { ok: false, error: "Online-Zahlung ist für diesen Verein nicht eingerichtet." };
  const tenant = await db.tenant.findUnique({ where: { id: viewer.tenantId }, select: { name: true } });
  const title = feeInvoiceTitle(inv, `Mitgliederbeitrag ${inv.year}`);
  try {
    const { redirectUrl, paymentData } = await beginCheckout(provider, { kind: "FEE_INVOICE", feeInvoiceId: inv.id }, {
      tenantId: viewer.tenantId,
      amountCents: inv.amountCents,
      currency: inv.currency,
      reference: inv.number,
      description: `${title} ${inv.number}${tenant?.name ? ` · ${tenant.name}` : ""}`.trim(),
      successUrl: appUrl(feeInvoiceReturnPath(inv.id)),
      failedUrl: appUrl(feeInvoiceReturnPath(inv.id)),
      cancelUrl: appUrl(`${feeInvoiceReturnPath(inv.id)}?cancelled=1`),
      customerEmail: viewer.email ?? inv.memberEmail ?? undefined,
      metadata: { feeInvoiceId: inv.id, invoiceNumber: inv.number },
    });
    await db.payment.create({ data: paymentData });
    return { ok: true, redirectUrl };
  } catch (e) {
    console.error("Checkout (Beitrag) fehlgeschlagen:", e);
    return { ok: false, error: e instanceof PaymentError ? e.message : "Zahlungsanbieter nicht erreichbar." };
  }
}

/**
 * REFUND_REVIEW: die Online-Zahlung ist eingegangen, die Rechnung war aber bereits bezahlt oder
 * storniert – der Verein prüft die Rückerstattung. `needsReview`: Betrag passt nicht (nicht weiter abfragen).
 */
export type FeePayStatus = { status: "PAID" | "PENDING" | "FAILED" | "NONE" | "CANCELLED" | "REFUND_REVIEW"; error?: string; needsReview?: boolean };

/** Letzte Online-Zahlung einer eigenen Rechnung beim Anbieter prüfen und verbuchen. */
export async function verifyFeeInvoicePayment(viewer: Viewer, invoiceId: string): Promise<FeePayStatus> {
  const inv = await loadOwnInvoice(viewer, invoiceId);
  if (!inv) return { status: "NONE" };
  let payment = await db.payment.findFirst({ where: { feeInvoiceId: inv.id }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, detailsJson: true } });
  if (!payment) return { status: inv.status === "PAID" ? "PAID" : inv.status === "CANCELLED" ? "CANCELLED" : "NONE" };
  // Bereits (z.B. per Bank) bezahlt und kein laufender Checkout: nicht beim Anbieter nachfragen.
  if (inv.status === "PAID" && payment.status !== "PAID" && payment.status !== "PENDING") return { status: "PAID" };
  if (payment.status !== "PAID") {
    const r = await refreshPaymentStatus(payment.id);
    if (r.status !== "PAID") return inv.status === "PAID" ? { status: "PAID" } : r;
    payment = (await db.payment.findUnique({ where: { id: payment.id }, select: { id: true, status: true, detailsJson: true } })) ?? payment;
  }
  return paymentReviewFromDetails(payment.detailsJson)?.kind === "REFUND" ? { status: "REFUND_REVIEW" } : { status: "PAID" };
}

/** Online-Zahlungen einer Rechnung (für Detailansichten). */
export async function listFeeInvoicePayments(tenantId: string, invoiceId: string) {
  return db.payment.findMany({ where: { feeInvoiceId: invoiceId, OR: [{ tenantId }, { feeInvoice: { tenantId } }] }, orderBy: { createdAt: "desc" }, take: 20 });
}
