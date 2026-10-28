import "server-only";
import { renderQrBillSvg } from "@/lib/qr-bill";
import { dueDateInDays } from "@/modules/billing/dates";
import { getBillingProfile, profileToCreditor, type BillingProfileView } from "./profile";
import { ensureReference } from "./reference";
import type { InvoiceDocumentProps } from "@/components/invoice-document";

type Inv = {
  id: string; tenantId: string; reference: string | null;
  number: string; issuedAt: Date; dueAt: Date; status: string; currency: string; amountCents: number; year: number;
  memberName: string; memberEmail: string | null; memberAddress: string | null; categoryName: string; remindedAt: Date | null;
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
export async function buildFeeInvoiceDocument(inv: Inv, tenantId: string, tenantName: string, opts?: { reminder?: boolean; profile?: BillingProfileView }): Promise<InvoiceDocumentProps> {
  const profile = opts?.profile ?? (await getBillingProfile(tenantId, tenantName));
  const creditor = profileToCreditor(profile, tenantName);
  const { street, zip, city } = splitMemberAddress(inv.memberAddress);
  const title = opts?.reminder ? "Zahlungserinnerung" : "Rechnung";
  const purpose = `${inv.run?.title ?? `Mitgliederbeitrag ${inv.year}`} ${inv.number}`;
  const reference = inv.status === "OPEN" && profile.qrIban ? await ensureReference("FEE", inv, profile.iban) : inv.reference;
  const qr = inv.status === "OPEN"
    ? await renderQrBillSvg({ amountCents: inv.amountCents, currency: inv.currency, creditor, debtor: { name: inv.memberName, street, zip, city }, message: purpose, reference: profile.qrIban ? reference : null })
    : null;
  return {
    title,
    number: inv.number,
    issuedAt: inv.issuedAt,
    dueAt: opts?.reminder ? dueDateInDays(14) : inv.dueAt,
    status: inv.status,
    currency: inv.currency,
    payee: creditor,
    debtor: { name: inv.memberName, email: inv.memberEmail, street, zip, city, memberNumber: inv.membership?.memberNumber ?? null },
    lines: [{ label: inv.run?.title ?? `Mitgliederbeitrag ${inv.year}`, sublabel: inv.categoryName, amountCents: inv.amountCents }],
    totalCents: inv.amountCents,
    intro: opts?.reminder ? `Für die Rechnung ${inv.number} haben wir bisher keinen Zahlungseingang festgestellt. Bitte begleichen Sie den Betrag innert 14 Tagen. Falls sich die Zahlung mit diesem Schreiben kreuzt, betrachten Sie es als gegenstandslos.` : null,
    note: inv.run?.note ?? null,
    reference: profile.qrIban ? reference : null,
    qrSvg: qr,
  };
}
