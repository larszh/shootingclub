import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { kioskReopenDecision, kioskReopenNeedsCount } from "./logic";

type Client = Prisma.TransactionClient | typeof db;

/**
 * Darf eine stornierte Rechnung wieder geöffnet oder als bezahlt markiert werden?
 * Nein, wenn ihre Schützenstube-Einträge freigegeben wurden: diese sind dann offen oder bereits
 * auf einer neuen Rechnung, und die alte Rechnung würde dieselben Konsumationen doppelt verlangen.
 * Erkannt an der Markierung in der Zahlungsnotiz oder (falls die Notiz inzwischen gekürzt wurde)
 * an einer Schützenstube-Einzelrechnung ohne verknüpfte Einträge (Regel: kioskReopenDecision).
 * Gibt eine Fehlermeldung zurück oder null, wenn der Statuswechsel erlaubt ist.
 */
export async function kioskReopenBlocked(
  client: Client,
  inv: { id: string; tenantId: string; status: string; runId: string | null; categoryName: string; paymentNote: string | null },
  next: string,
): Promise<string | null> {
  const linked = kioskReopenNeedsCount(inv, next) ? await client.kioskEntry.count({ where: { tenantId: inv.tenantId, billedInvoiceId: inv.id } }) : null;
  return kioskReopenDecision(inv, next, linked);
}

/** Für Listen: welche dieser stornierten Rechnungen dürfen nicht mehr reaktiviert werden? (IDs) */
export async function kioskReopenBlockedIds(
  client: Client,
  tenantId: string,
  invoices: Array<{ id: string; status: string; runId: string | null; categoryName: string; paymentNote: string | null }>,
): Promise<Set<string>> {
  const need = invoices.filter((i) => kioskReopenNeedsCount(i, "OPEN"));
  const counts = new Map<string, number>();
  if (need.length) {
    const rows = await client.kioskEntry.groupBy({ by: ["billedInvoiceId"], where: { tenantId, billedInvoiceId: { in: need.map((i) => i.id) } }, _count: { _all: true } });
    for (const r of rows) if (r.billedInvoiceId) counts.set(r.billedInvoiceId, r._count._all);
  }
  return new Set(invoices.filter((i) => kioskReopenDecision(i, "OPEN", kioskReopenNeedsCount(i, "OPEN") ? (counts.get(i.id) ?? 0) : null)).map((i) => i.id));
}
