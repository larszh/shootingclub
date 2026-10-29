import "server-only";
import { db } from "@/lib/db";
import { renderQrBillSvg } from "@/lib/qr-bill";
import { INTL_LOCALE, formatDate, formatMoneyLocale, getT, getTenantLocale } from "@/lib/i18n";
import { getBillingProfile, profileToCreditor } from "@/modules/billing/profile";
import type { InvoiceDocumentProps } from "@/components/invoice-document";
import { ensureAmmoReference, getAmmoSettings } from "./service";

type OrderForInvoice = {
  id: string; tenantId: string; userId: string | null; invoiceNumber: string | null; reference: string | null;
  invoiceIssuedAt: Date | null; issuedAt: Date | null; dueAt: Date | null; createdAt: Date;
  paymentStatus: string; totalCents: number; currency: string;
  items: Array<{ productName: string; caliber: string; unitLabel: string; roundsPerUnit: number; quantity: number; unitPriceCents: number; totalCents: number }>;
};

/** Druckdaten einer Munitionsrechnung inkl. QR-Zahlteil (nur solange unbezahlt). */
export async function buildAmmoInvoiceDocument(order: OrderForInvoice, tenantName: string): Promise<InvoiceDocumentProps> {
  const [locale, profile, settings, user, membership] = await Promise.all([
    getTenantLocale(order.tenantId),
    getBillingProfile(order.tenantId, tenantName),
    getAmmoSettings(order.tenantId),
    order.userId ? db.user.findUnique({ where: { id: order.userId }, select: { name: true, email: true, street: true, zip: true, city: true } }) : null,
    order.userId ? db.membership.findUnique({ where: { userId_tenantId: { userId: order.userId, tenantId: order.tenantId } }, select: { memberNumber: true } }) : null,
  ]);
  const t = getT(locale);
  const nf = new Intl.NumberFormat(INTL_LOCALE[locale]);
  const roundsLabel = (count: number) => t("invoice.ammoRounds", { count: nf.format(count) });
  const creditor = profileToCreditor(profile, tenantName);
  const status = order.paymentStatus === "PAID" ? "PAID" : order.paymentStatus === "CANCELLED" ? "CANCELLED" : "OPEN";
  const number = order.invoiceNumber ?? "–";
  const reference = status === "OPEN" && profile.qrIban ? await ensureAmmoReference(order, profile.iban) : order.reference;
  const debtor = { name: user?.name ?? t("invoice.member"), email: user?.email ?? null, street: user?.street ?? null, zip: user?.zip ?? null, city: user?.city ?? null };
  const qrSvg = status === "OPEN"
    ? await renderQrBillSvg({ amountCents: order.totalCents, currency: order.currency, creditor, debtor, message: order.invoiceNumber ? t("invoice.ammoTitle", { number: order.invoiceNumber }).trim() : t("invoice.ammo"), reference: profile.qrIban ? reference : null, locale })
    : null;
  const rounds = order.items.reduce((a, i) => a + i.quantity * i.roundsPerUnit, 0);
  const issuedAt = order.invoiceIssuedAt ?? order.issuedAt ?? order.createdAt;

  return {
    locale,
    title: t("invoice.title"),
    number,
    issuedAt,
    dueAt: order.dueAt ?? issuedAt,
    status,
    currency: order.currency,
    payee: creditor,
    debtor: { ...debtor, memberNumber: membership?.memberNumber ?? null },
    intro: t("invoice.ammoIntro", { date: formatDate(order.issuedAt ?? issuedAt, locale), rounds: roundsLabel(rounds) }),
    lines: order.items.map((i) => ({
      label: t("invoice.ammoLine", { product: i.productName, caliber: i.caliber }),
      sublabel: t("invoice.ammoQuantity", { quantity: i.quantity, unit: i.unitLabel, price: formatMoneyLocale(i.unitPriceCents, locale, order.currency), rounds: roundsLabel(i.quantity * i.roundsPerUnit) }),
      amountCents: i.totalCents,
    })),
    totalCents: order.totalCents,
    note: settings.onSiteOnly ? t("invoice.ammoOnSite") : null,
    reference: profile.qrIban ? reference : null,
    qrSvg,
  };
}
