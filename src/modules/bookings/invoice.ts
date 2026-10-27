import "server-only";
import { db } from "@/lib/db";
import { zurichParts } from "@/lib/time";

/** Legt für eine bestätigte Rechnungs-Buchung eine Rechnung mit fortlaufender Nummer an (idempotent). */
export async function ensureInvoiceForBooking(bookingId: string) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { invoice: true } });
  if (!b || b.invoice || b.paymentMethod !== "INVOICE" || b.totalCents <= 0) return b?.invoice ?? null;
  const settings = await db.bookingSettings.findUnique({ where: { tenantId: b.tenantId } });
  const prefix = settings?.invoicePrefix ?? "R-";
  const dueDays = settings?.invoiceDueDays ?? 30;
  const year = zurichParts(new Date()).dateStr.slice(0, 4);
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await db.invoice.count({ where: { tenantId: b.tenantId, number: { startsWith: `${prefix}${year}-` } } });
    const number = `${prefix}${year}-${String(count + 1 + attempt).padStart(4, "0")}`;
    try {
      return await db.invoice.create({
        data: { tenantId: b.tenantId, bookingId: b.id, number, dueAt: new Date(Date.now() + dueDays * 86_400_000), amountCents: b.totalCents, currency: b.currency },
      });
    } catch (e) {
      if (attempt === 4) throw e;
    }
  }
  return null;
}
