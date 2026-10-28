import "server-only";
import { db } from "@/lib/db";

/**
 * Markiert eine Munitionsrechnung als bezahlt (z.B. aus dem camt-Bankimport).
 * Idempotent und auf den Verein beschränkt: bereits bezahlte Rechnungen bleiben unverändert.
 * Rückgabe: "paid" (jetzt markiert), "already" (war schon bezahlt) oder "not_found"
 * (keine ausgegebene Rechnung mit dieser ID im Verein bzw. Rechnung storniert).
 */
export async function markAmmoInvoicePaid(tenantId: string, orderId: string, paidAt: Date, note?: string | null): Promise<"paid" | "already" | "not_found"> {
  const res = await db.ammoOrder.updateMany({
    where: { id: orderId, tenantId, status: "ISSUED", invoiceNumber: { not: null }, paymentStatus: "UNPAID" },
    data: { paymentStatus: "PAID", paidAt, ...(note?.trim() ? { paymentNote: note.trim().slice(0, 191) } : {}) },
  });
  if (res.count > 0) return "paid";
  const existing = await db.ammoOrder.findFirst({ where: { id: orderId, tenantId, invoiceNumber: { not: null } }, select: { paymentStatus: true } });
  return existing?.paymentStatus === "PAID" ? "already" : "not_found";
}
