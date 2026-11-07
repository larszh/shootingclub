import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

/**
 * Buchungsrelevante Statuswechsel (Storno, Rückerstattung) im Protokoll.
 *
 * Das Datum steht heute in eigenen Spalten (FeeInvoice/Invoice/AmmoOrder.cancelledAt,
 * Booking.refundedAt), die beim Statuswechsel gesetzt werden. Der Protokolleintrag bleibt als
 * Nachweis (wer, wann) und ist der Rückfall für ältere Belege ohne Spalte oder mit einer Spalte, die die
 * Migration aus `updatedAt` nachgetragen hat; erst danach gilt `updatedAt` (siehe reversalDate in journal.ts).
 */

export const ACCOUNTING_EVENT = {
  cancel: "accounting.doc.cancel",
  refund: "accounting.doc.refund",
} as const;

export type AccountingEventKind = keyof typeof ACCOUNTING_EVENT;
export type AccountingEntity = "FeeInvoice" | "AmmoOrder" | "Booking";

/**
 * Statuswechsel festhalten: aufrufen, sobald ein Beleg storniert (cancel) bzw. eine Reservation als
 * erstattet markiert wird (refund) – nur beim Wechsel, nicht bei späteren Änderungen. Wirft nie.
 */
export async function recordAccountingEvent(e: {
  tenantId: string;
  kind: AccountingEventKind;
  entity: AccountingEntity;
  entityId: string;
  actorId?: string | null;
  actorName?: string | null;
  detail?: string;
}) {
  await audit({ tenantId: e.tenantId, actorId: e.actorId, actorName: e.actorName, action: ACCOUNTING_EVENT[e.kind], entity: e.entity, entityId: e.entityId, detail: e.detail });
}

/** Schlüssel für eventDates: «cancel:AmmoOrder:<id>» */
export const eventKey = (kind: AccountingEventKind, entity: AccountingEntity, id: string) => `${kind}:${entity}:${id}`;

/** Letztes Datum je Statuswechsel und Beleg (ein erneutes Storno nach Reaktivierung zählt). */
export async function loadAccountingEventDates(tenantId: string, refs: Array<{ entity: AccountingEntity; ids: string[] }>) {
  const map = new Map<string, Date>();
  const wanted = refs.filter((r) => r.ids.length);
  if (!wanted.length) return map;
  const rows = await db.auditLog.findMany({
    where: {
      tenantId,
      action: { in: Object.values(ACCOUNTING_EVENT) },
      OR: wanted.map((r) => ({ entity: r.entity, entityId: { in: r.ids } })),
    },
    select: { action: true, entity: true, entityId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const kindOf = Object.fromEntries(Object.entries(ACCOUNTING_EVENT).map(([k, v]) => [v, k])) as Record<string, AccountingEventKind>;
  for (const r of rows) {
    const kind = kindOf[r.action];
    if (!kind || !r.entity || !r.entityId) continue;
    map.set(eventKey(kind, r.entity as AccountingEntity, r.entityId), r.createdAt);
  }
  return map;
}
