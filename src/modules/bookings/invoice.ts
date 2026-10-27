import "server-only";
import { db } from "@/lib/db";
import { zurichParts } from "@/lib/time";
import { ensureReference } from "@/modules/billing/reference";

/**
 * Legt für eine bestätigte Rechnungs-Buchung eine Rechnung mit fortlaufender Nummer an (idempotent).
 * Bei QR-IBAN im Rechnungsprofil erhält die Rechnung sofort eine QR-Referenz.
 */
export async function ensureInvoiceForBooking(bookingId: string) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { invoice: true } });
  if (!b || b.invoice || b.paymentMethod !== "INVOICE" || b.totalCents <= 0) return b?.invoice ?? null;
  const settings = await db.bookingSettings.findUnique({ where: { tenantId: b.tenantId } });
  const prefix = settings?.invoicePrefix ?? "R-";
  const dueDays = settings?.invoiceDueDays ?? 30;
  const now = new Date();
  const year = zurichParts(now).dateStr.slice(0, 4);
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await db.invoice.count({ where: { tenantId: b.tenantId, number: { startsWith: `${prefix}${year}-` } } });
    const number = `${prefix}${year}-${String(count + 1 + attempt).padStart(4, "0")}`;
    let created;
    try {
      created = await db.invoice.create({
        data: { tenantId: b.tenantId, bookingId: b.id, number, dueAt: new Date(now.getTime() + dueDays * 86_400_000), amountCents: b.totalCents, currency: b.currency },
      });
    } catch (e) {
      if (attempt === 4) throw e;
      continue;
    }
    const reference = await ensureReference("BOOKING", created);
    return reference ? { ...created, reference } : created;
  }
  return null;
}
