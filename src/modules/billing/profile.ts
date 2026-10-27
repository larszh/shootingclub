import "server-only";
import { db } from "@/lib/db";

export type BillingProfileView = {
  payeeName: string | null; payeeStreet: string | null; payeeZip: string | null; payeeCity: string | null; iban: string | null; currency: string;
  /** true, wenn alle Angaben für eine QR-Rechnung vorhanden sind */
  qrReady: boolean;
};

export async function getBillingProfile(tenantId: string, tenantName?: string): Promise<BillingProfileView> {
  const p = await db.billingProfile.findUnique({ where: { tenantId } });
  const v = { payeeName: p?.payeeName ?? tenantName ?? null, payeeStreet: p?.payeeStreet ?? null, payeeZip: p?.payeeZip ?? null, payeeCity: p?.payeeCity ?? null, iban: p?.iban ?? null, currency: p?.currency ?? "CHF" };
  return { ...v, qrReady: !!(v.payeeName && v.payeeStreet && v.payeeZip && v.payeeCity && v.iban) };
}

export function profileToCreditor(p: BillingProfileView, fallbackName: string) {
  return { name: p.payeeName ?? fallbackName, street: p.payeeStreet ?? "", zip: p.payeeZip ?? "", city: p.payeeCity ?? "", iban: p.iban ?? "" };
}
