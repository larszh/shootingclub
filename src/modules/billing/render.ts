import "server-only";
import { db } from "@/lib/db";
import { renderQrBillSvg } from "@/lib/qr-bill";
import { getT, getTenantLocale } from "@/lib/i18n";
import { dueDateInDays } from "@/modules/billing/dates";
import { getBillingProfile, profileToCreditor, type BillingProfileView } from "./profile";
import { ensureReference } from "./reference";
import { feeInvoiceTitle, isStandaloneFeeInvoice } from "./fee-title";
import type { InvoiceDocumentProps } from "@/components/invoice-document";

type Inv = {
  id: string; tenantId: string; reference: string | null;
  number: string; issuedAt: Date; dueAt: Date; status: string; currency: string; amountCents: number; year: number;
  memberName: string; memberEmail: string | null; memberAddress: string | null; categoryName: string; remindedAt: Date | null;
  runId?: string | null; membershipId?: string | null;
  run?: { title: string; note: string | null } | null;
  membership?: { memberNumber: string | null } | null;
};

/** Zerlegt die mehrzeilige Snapshot-Adresse in Strasse, PLZ, Ort. */
export function splitMemberAddress(memberAddress: string | null) {
  const addr = (memberAddress ?? "").split("\n");
  const street = addr.length > 1 ? addr[0]! : null;
  const zipCity = addr.length > 1 ? addr[1] : addr[0] || null;
  const [zip, ...cityParts] = (zipCity ?? "").split(" ");
  return { street, zip: zip || null, city: cityParts.join(" ") || null };
}

/**
 * Baut die Druckdaten einer Beitragsrechnung (optional als Zahlungserinnerung).
 * Bei QR-IBAN erhält eine offene Rechnung ohne Referenz jetzt eine (wird gespeichert).
 */
export async function buildFeeInvoiceDocument(inv: Inv, tenantId: string, tenantName: string, opts?: { reminder?: boolean; profile?: BillingProfileView; locale?: string }): Promise<InvoiceDocumentProps> {
  const profile = opts?.profile ?? (await getBillingProfile(tenantId, tenantName));
  // Rechnungen erscheinen in der Vereinssprache (Tenant.defaultLocale).
  const locale = opts?.locale ?? (await getTenantLocale(tenantId));
  const t = getT(locale);
  const creditor = profileToCreditor(profile, tenantName);
  const { street, zip, city } = splitMemberAddress(inv.memberAddress);
  const title = opts?.reminder ? t("invoice.reminder") : t("invoice.title");
  const feeLabel = feeInvoiceTitle(inv, t("invoice.annualFeeYear", { year: inv.year }));
  const purpose = `${feeLabel} ${inv.number}`;
  const reference = inv.status === "OPEN" && profile.qrIban ? await ensureReference("FEE", inv, profile.iban) : inv.reference;
  const qr = inv.status === "OPEN"
    ? await renderQrBillSvg({ amountCents: inv.amountCents, currency: inv.currency, creditor, debtor: { name: inv.memberName, street, zip, city }, message: purpose, reference: profile.qrIban ? reference : null, locale })
    : null;
  // Schützenstube-Einzelrechnung: die verrechneten Konsumationen einzeln aufführen.
  const kioskEntries = inv.runId
    ? []
    : await db.kioskEntry.findMany({
        where: { tenantId: inv.tenantId, billedInvoiceId: inv.id },
        select: { createdAt: true, quantity: true, productName: true, totalCents: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
  const items = kioskEntries.map((e) => ({ date: e.createdAt, label: `${e.quantity} × ${e.productName}`, amountCents: e.totalCents }));
  return {
    locale,
    title,
    number: inv.number,
    issuedAt: inv.issuedAt,
    dueAt: opts?.reminder ? dueDateInDays(14) : inv.dueAt,
    status: inv.status,
    currency: inv.currency,
    payee: creditor,
    debtor: { name: inv.memberName, email: inv.memberEmail, street, zip, city, memberNumber: inv.membership?.memberNumber ?? null },
    lines: [{ label: feeLabel, sublabel: isStandaloneFeeInvoice(inv) ? null : inv.categoryName, amountCents: inv.amountCents, ...(items.length ? { items } : {}) }],
    totalCents: inv.amountCents,
    intro: opts?.reminder ? t("invoice.reminderIntro", { number: inv.number }) : null,
    note: inv.run?.note ?? null,
    reference: profile.qrIban ? reference : null,
    qrSvg: qr,
  };
}
