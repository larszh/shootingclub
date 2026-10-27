import "server-only";
import { renderQrBillSvg } from "@/lib/qr-bill";
import { getBillingProfile, profileToCreditor } from "./profile";
import type { InvoiceDocumentProps } from "@/components/invoice-document";

type Inv = {
  number: string; issuedAt: Date; dueAt: Date; status: string; currency: string; amountCents: number; year: number;
  memberName: string; memberEmail: string | null; memberAddress: string | null; categoryName: string; remindedAt: Date | null;
  run?: { title: string; note: string | null } | null;
  membership?: { memberNumber: string | null } | null;
};

/** Baut die Druckdaten einer Beitragsrechnung (optional als Zahlungserinnerung). */
export async function buildFeeInvoiceDocument(inv: Inv, tenantId: string, tenantName: string, opts?: { reminder?: boolean }): Promise<InvoiceDocumentProps> {
  const profile = await getBillingProfile(tenantId, tenantName);
  const creditor = profileToCreditor(profile, tenantName);
  const addr = (inv.memberAddress ?? "").split("\n");
  const street = addr.length > 1 ? addr[0] : null;
  const zipCity = addr.length > 1 ? addr[1] : addr[0] || null;
  const [zip, ...cityParts] = (zipCity ?? "").split(" ");
  const city = cityParts.join(" ") || null;
  const title = opts?.reminder ? "Zahlungserinnerung" : "Rechnung";
  const qr = inv.status === "OPEN"
    ? await renderQrBillSvg({ amountCents: inv.amountCents, currency: inv.currency, creditor, debtor: { name: inv.memberName, street, zip: zip || null, city }, message: `${inv.run?.title ?? `Mitgliederbeitrag ${inv.year}`} ${inv.number}` })
    : null;
  return {
    title,
    number: inv.number,
    issuedAt: inv.issuedAt,
    dueAt: opts?.reminder ? new Date(Date.now() + 14 * 86_400_000) : inv.dueAt,
    status: inv.status,
    currency: inv.currency,
    payee: creditor,
    debtor: { name: inv.memberName, email: inv.memberEmail, street, zip: zip || null, city, memberNumber: inv.membership?.memberNumber ?? null },
    lines: [{ label: inv.run?.title ?? `Mitgliederbeitrag ${inv.year}`, sublabel: inv.categoryName, amountCents: inv.amountCents }],
    totalCents: inv.amountCents,
    intro: opts?.reminder ? `Für die Rechnung ${inv.number} haben wir bisher keinen Zahlungseingang festgestellt. Bitte begleichen Sie den Betrag innert 14 Tagen. Falls sich die Zahlung mit diesem Schreiben kreuzt, betrachten Sie es als gegenstandslos.` : null,
    note: inv.run?.note ?? null,
    qrSvg: qr,
  };
}
