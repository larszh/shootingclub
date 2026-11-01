import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isKioskReleasedNote } from "./logic";

type Client = Prisma.TransactionClient | typeof db;

/**
 * Darf eine stornierte Rechnung wieder geöffnet oder als bezahlt markiert werden?
 * Nein, wenn ihre Schützenstube-Einträge freigegeben wurden: diese sind dann offen oder bereits
 * auf einer neuen Rechnung, und die alte Rechnung würde dieselben Konsumationen doppelt verlangen.
 * Erkannt an der Markierung in der Zahlungsnotiz oder (falls die Notiz inzwischen gekürzt wurde)
 * an einer Schützenstube-Einzelrechnung ohne verknüpfte Einträge.
 * Gibt eine Fehlermeldung zurück oder null, wenn der Statuswechsel erlaubt ist.
 */
export async function kioskReopenBlocked(
  client: Client,
  inv: { id: string; tenantId: string; status: string; runId: string | null; categoryName: string; paymentNote: string | null },
  next: string,
): Promise<string | null> {
  if (inv.status !== "CANCELLED" || next === "CANCELLED") return null;
  const msg = "Die Einträge dieser Schützenstube-Rechnung wurden freigegeben und neu verrechnet. Die stornierte Rechnung kann nicht mehr reaktiviert werden.";
  if (isKioskReleasedNote(inv.paymentNote)) return msg;
  if (inv.runId || !inv.categoryName.startsWith("Schützenstube ")) return null;
  const linked = await client.kioskEntry.count({ where: { tenantId: inv.tenantId, billedInvoiceId: inv.id } });
  return linked ? null : msg;
}
